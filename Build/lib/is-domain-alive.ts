import tldts from 'tldts-experimental';
import { looseTldtsOpt } from '../constants/loose-tldts-opt';
import picocolors from 'picocolors';
import { pickRandom, pickOne } from 'foxts/pick-random';

import DNS2 from 'dns2';
import asyncRetry from 'async-retry';
import * as whoiser from 'whoiser';

import { createRetrieKeywordFilter as createKeywordFilter } from 'foxts/retrie';

import process from 'node:process';

const mutex = new Map<string, Promise<unknown>>();
export function keyedAsyncMutexWithQueue<T>(key: string, fn: () => Promise<T>) {
  if (mutex.has(key)) {
    return mutex.get(key) as Promise<T>;
  }
  const promise = fn();
  mutex.set(key, promise);
  return promise;
}

class DnsError extends Error {
  name = 'DnsError';
  constructor(readonly message: string, public readonly server: string) {
    super(message);
  }
}

interface DnsResponse extends DNS2.$DnsResponse {
  dns: string
}

const dohServers: Array<[string, DNS2.DnsResolver]> = ([
  '8.8.8.8',
  '8.8.4.4',
  '1.0.0.1',
  '1.1.1.1',
  '162.159.36.1',
  '162.159.46.1',
  '101.101.101.101', // TWNIC
  '185.222.222.222', // DNS.SB
  '45.11.45.11', // DNS.SB
  'dns10.quad9.net', // Quad9 unfiltered
  'doh.sandbox.opendns.com', // OpenDNS sandbox (unfiltered)
  'unfiltered.adguard-dns.com',
  // '0ms.dev', // Proxy Cloudflare
  // '76.76.2.0', // ControlD unfiltered, path not /dns-query
  // '76.76.10.0', // ControlD unfiltered, path not /dns-query
  // 'dns.bebasid.com', // BebasID, path not /dns-query but /unfiltered
  // '193.110.81.0', // dns0.eu
  // '185.253.5.0', // dns0.eu
  // 'zero.dns0.eu',
  'dns.nextdns.io',
  'anycast.dns.nextdns.io',
  'wikimedia-dns.org',
  'puredns.org',
  // 'ordns.he.net',
  // 'dns.mullvad.net',
  'basic.rethinkdns.com',
  '198.54.117.10' // NameCheap DNS, supports DoT, DoH, UDP53
  // 'ada.openbld.net',
  // 'dns.rabbitdns.org'
] as const).map(dns => [
  dns,
  DNS2.DOHClient({
    dns,
    http: false
  })
] as const);

const domesticDohServers: Array<[string, DNS2.DnsResolver]> = ([
  '223.5.5.5',
  '223.6.6.6',
  '120.53.53.53',
  '1.12.12.12'
] as const).map(dns => [
  dns,
  DNS2.DOHClient({
    dns,
    http: false
  })
] as const);

async function $resolve(name: string, type: DNS2.PacketQuestion, server: [string, DNS2.DnsResolver]) {
  try {
    return await asyncRetry(async () => {
      const [dohServer, dohClient] = server;

      try {
        return {
          ...await dohClient(name, type),
          dns: dohServer
        } satisfies DnsResponse;
      } catch (e) {
        // console.error(e);
        throw new DnsError((e as Error).message, dohServer);
      }
    }, { retries: 5 });
  } catch (e) {
    console.log('[doh error]', name, type, e);
    throw e;
  }
}

async function getWhois(domain: string) {
  return asyncRetry(() => whoiser.domain(domain, { raw: true }), { retries: 5 });
}

const domainAliveMap = new Map<string, boolean>();
function onDomainAlive(domain: string): [string, boolean] {
  domainAliveMap.set(domain, true);
  return [domain, true];
}
function onDomainDead(domain: string): [string, boolean] {
  domainAliveMap.set(domain, false);
  return [domain, false];
}

export async function isDomainAlive(domain: string, isSuffix: boolean): Promise<[string, boolean]> {
  if (domainAliveMap.has(domain)) {
    return [domain, domainAliveMap.get(domain)!];
  }

  const apexDomain = tldts.getDomain(domain, looseTldtsOpt);
  if (!apexDomain) {
    console.log(picocolors.gray('[domain invalid]'), picocolors.gray('no apex domain'), { domain });
    return onDomainAlive(domain);
  }

  const apexDomainAlive = await keyedAsyncMutexWithQueue(apexDomain, () => isApexDomainAlive(apexDomain));
  if (isSuffix) {
    return apexDomainAlive;
  }
  if (!apexDomainAlive[1]) {
    return apexDomainAlive;
  }

  const $domain = domain[0] === '.' ? domain.slice(1) : domain;

  const aDns: string[] = [];
  const aaaaDns: string[] = [];

  // test 2 times before make sure record is empty
  const servers = pickRandom(dohServers, 2);
  for (let i = 0; i < 2; i++) {
    // eslint-disable-next-line no-await-in-loop -- sequential
    const aRecords = (await $resolve($domain, 'A', servers[i]));
    if (aRecords.answers.length > 0) {
      return onDomainAlive(domain);
    }

    aDns.push(aRecords.dns);
  }
  for (let i = 0; i < 2; i++) {
    // eslint-disable-next-line no-await-in-loop -- sequential
    const aaaaRecords = (await $resolve($domain, 'AAAA', servers[i]));
    if (aaaaRecords.answers.length > 0) {
      return onDomainAlive(domain);
    }

    aaaaDns.push(aaaaRecords.dns);
  }

  // only then, let's test once with domesticDohServers
  const aRecords = (await $resolve($domain, 'A', pickOne(domesticDohServers)));
  if (aRecords.answers.length > 0) {
    return onDomainAlive(domain);
  }
  aDns.push(aRecords.dns);

  const aaaaRecords = (await $resolve($domain, 'AAAA', pickOne(domesticDohServers)));
  if (aaaaRecords.answers.length > 0) {
    return onDomainAlive(domain);
  }
  aaaaDns.push(aaaaRecords.dns);

  console.log(picocolors.red('[domain dead]'), 'no A/AAAA records', { domain, a: aDns, aaaa: aaaaDns });
  return onDomainDead($domain);
}

const apexDomainNsResolvePromiseMap = new Map<string, Promise<boolean>>();

async function getNS(domain: string) {
  const servers = pickRandom(dohServers, 2);
  for (let i = 0, len = servers.length; i < len; i++) {
    const server = servers[i];
    // eslint-disable-next-line no-await-in-loop -- one by one
    const resp = await $resolve(domain, 'NS', server);
    if (resp.answers.length > 0) {
      return true;
    }
  }
  return false;
}

async function isApexDomainAlive(apexDomain: string): Promise<[string, boolean]> {
  if (domainAliveMap.has(apexDomain)) {
    return [apexDomain, domainAliveMap.get(apexDomain)!];
  }

  let hasNS: boolean;
  if (apexDomainNsResolvePromiseMap.has(apexDomain)) {
    hasNS = await apexDomainNsResolvePromiseMap.get(apexDomain)!;
  } else {
    const promise = getNS(apexDomain);
    apexDomainNsResolvePromiseMap.set(apexDomain, promise);
    hasNS = await promise;
  }

  if (hasNS) {
    return onDomainAlive(apexDomain);
  }

  let whois;

  try {
    whois = await getWhois(apexDomain);
  } catch (e) {
    console.log(picocolors.red('[whois error]'), { domain: apexDomain }, e);
    return onDomainAlive(apexDomain);
  }

  if (process.env.DEBUG) {
    console.log(JSON.stringify(whois, null, 2));
  }

  const whoisError = noWhois(whois);
  if (!whoisError) {
    console.log(picocolors.gray('[domain alive]'), picocolors.gray('whois found'), { domain: apexDomain });
    return onDomainAlive(apexDomain);
  }

  console.log(picocolors.red('[domain dead]'), 'whois not found', { domain: apexDomain, err: whoisError });
  return onDomainDead(apexDomain);
}

// TODO: this is a workaround for https://github.com/LayeredStudio/whoiser/issues/117
const whoisNotFoundKeywordTest = createKeywordFilter([
  'no match for',
  'does not exist',
  'not found',
  'no found',
  'no entries',
  'no data found',
  'is available for registration',
  'currently available for application',
  'no matching record',
  'no information available about domain name',
  'not been registered',
  'no match!!',
  'status: available',
  ' is free',
  'no object found',
  'nothing found',
  'status: free',
  'pendingdelete',
  ' has been blocked by '
]);

// whois server can redirect, so whoiser might/will get info from multiple whois servers
// some servers (like TLD whois servers) might have cached/outdated results
// we can only make sure a domain is alive once all response from all whois servers demonstrate so
export function noWhois(whois: whoiser.WhoisSearchResult): null | string {
  let empty = true;

  for (const key in whois) {
    if (Object.hasOwn(whois, key)) {
      empty = false;

      // if (key === 'error') {
      //   // if (
      //   //   (typeof whois.error === 'string' && whois.error)
      //   //   || (Array.isArray(whois.error) && whois.error.length > 0)
      //   // ) {
      //   //   console.error(whois);
      //   //   return true;
      //   // }
      //   continue;
      // }

      // if (key === 'text') {
      //   if (Array.isArray(whois.text)) {
      //     for (const value of whois.text) {
      //       if (whoisNotFoundKeywordTest(value.toLowerCase())) {
      //         return value;
      //       }
      //     }
      //   }
      //   continue;
      // }
      // if (key === 'Name Server') {
      //   // if (Array.isArray(whois[key]) && whois[key].length === 0) {
      //   //   return false;
      //   // }
      //   continue;
      // }

      // if (key === 'Domain Status') {
      //   if (Array.isArray(whois[key])) {
      //     for (const status of whois[key]) {
      //       if (status === 'free' || status === 'AVAILABLE') {
      //         return key + ': ' + status;
      //       }
      //       if (whoisNotFoundKeywordTest(status.toLowerCase())) {
      //         return key + ': ' + status;
      //       }
      //     }
      //   }

      //   continue;
      // }

      // if (typeof whois[key] === 'string' && whois[key]) {
      //   if (whoisNotFoundKeywordTest(whois[key].toLowerCase())) {
      //     return key + ': ' + whois[key];
      //   }

      //   continue;
      // }

      if (key === '__raw' && typeof whois.__raw === 'string') {
        const lines = whois.__raw.trim().toLowerCase().replaceAll(/[\t ]+/g, ' ').split(/\r?\n/);

        if (process.env.DEBUG) {
          console.log({ lines });
        }

        for (const line of lines) {
          if (whoisNotFoundKeywordTest(line)) {
            return line;
          }
        }
        continue;
      }

      if (typeof whois[key] === 'object' && !Array.isArray(whois[key])) {
        const tmp = noWhois(whois[key]);
        if (tmp) {
          return tmp;
        }
        continue;
      }
    }
  }

  if (empty) {
    return 'whois is empty';
  }

  return null;
}
