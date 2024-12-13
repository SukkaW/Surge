import DNS2 from 'dns2';
import { readFileByLine } from './lib/fetch-text-by-line';
import { processLine } from './lib/process-line';
import tldts from 'tldts';
import { looseTldtsOpt } from './constants/loose-tldts-opt';
import { fdir as Fdir } from 'fdir';
import { SOURCE_DIR } from './constants/dir';
import path from 'node:path';
import { newQueue } from '@henrygd/queue';
import asyncRetry from 'async-retry';
import * as whoiser from 'whoiser';
import picocolors from 'picocolors';
import { createAhoCorasick as createKeywordFilter } from 'foxts/ahocorasick';
import './lib/fetch-retry';

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
  // 'ordns.he.net',
  // 'dns.mullvad.net',
  'basic.rethinkdns.com'
  // 'ada.openbld.net',
  // 'dns.rabbitdns.org'
] as const).map(dns => [
  dns,
  DNS2.DOHClient({
    dns,
    http: false
    // get: (url: string) => undici.request(url).then(r => r.body)
  })
] as const);

const queue = newQueue(32);
const mutex = new Map<string, Promise<unknown>>();
function keyedAsyncMutexWithQueue<T>(key: string, fn: () => Promise<T>) {
  if (mutex.has(key)) {
    return mutex.get(key) as Promise<T>;
  }
  const promise = queue.add(() => fn());
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

const resolve: DNS2.DnsResolver<DnsResponse> = async (...args) => {
  try {
    return await asyncRetry(async () => {
      const [dohServer, dohClient] = dohServers[Math.floor(Math.random() * dohServers.length)];

      try {
        return {
          ...await dohClient(...args),
          dns: dohServer
        } satisfies DnsResponse;
      } catch (e) {
        console.error(e);
        throw new DnsError((e as Error).message, dohServer);
      }
    }, { retries: 5 });
  } catch (e) {
    console.log('[doh error]', ...args, e);
    throw e;
  }
};

async function getWhois(domain: string) {
  return asyncRetry(() => whoiser.domain(domain), { retries: 5 });
}

(async () => {
  const domainSets = await new Fdir()
    .withFullPaths()
    .crawl(SOURCE_DIR + path.sep + 'domainset')
    .withPromise();
  const domainRules = await new Fdir()
    .withFullPaths()
    .crawl(SOURCE_DIR + path.sep + 'non_ip')
    .withPromise();

  await Promise.all([
    ...domainSets.map(runAgainstDomainset),
    ...domainRules.map(runAgainstRuleset)
  ]);

  console.log('done');
})();

const whoisNotFoundKeywordTest = createKeywordFilter([
  'no match for',
  'does not exist',
  'not found'
]);

const domainAliveMap = new Map<string, boolean>();
async function isApexDomainAlive(apexDomain: string): Promise<[string, boolean]> {
  if (domainAliveMap.has(apexDomain)) {
    return [apexDomain, domainAliveMap.get(apexDomain)!];
  }

  const resp = await resolve(apexDomain, 'NS');

  if (resp.answers.length > 0) {
    return [apexDomain, true];
  }

  let whois;

  try {
    whois = await getWhois(apexDomain);
  } catch (e) {
    console.log('[whois fail]', 'whois error', { domain: apexDomain }, e);
    return [apexDomain, true];
  }

  if (Object.keys(whois).length > 0) {
    // TODO: this is a workaround for https://github.com/LayeredStudio/whoiser/issues/117
    if ('text' in whois && Array.isArray(whois.text) && whois.text.some(value => whoisNotFoundKeywordTest(value.toLowerCase()))) {
      console.log(picocolors.red('[domain dead]'), 'whois not found', { domain: apexDomain });
      domainAliveMap.set(apexDomain, false);
      return [apexDomain, false];
    }

    return [apexDomain, true];
  }

  if (!('dns' in whois)) {
    console.log({ whois });
  }

  console.log(picocolors.red('[domain dead]'), 'whois not found', { domain: apexDomain });
  domainAliveMap.set(apexDomain, false);
  return [apexDomain, false];
}

export async function isDomainAlive(domain: string, isSuffix: boolean): Promise<[string, boolean]> {
  if (domainAliveMap.has(domain)) {
    return [domain, domainAliveMap.get(domain)!];
  }

  const apexDomain = tldts.getDomain(domain, looseTldtsOpt);
  if (!apexDomain) {
    console.log('[domain invalid]', 'no apex domain', { domain });
    domainAliveMap.set(domain, true);
    return [domain, true] as const;
  }

  const apexDomainAlive = await isApexDomainAlive(apexDomain);

  if (!apexDomainAlive[1]) {
    domainAliveMap.set(domain, false);
    return [domain, false] as const;
  }

  const $domain = domain[0] === '.' ? domain.slice(1) : domain;

  if (!isSuffix) {
    const aDns: string[] = [];
    const aaaaDns: string[] = [];

    // test 2 times before make sure record is empty
    for (let i = 0; i < 2; i++) {
      // eslint-disable-next-line no-await-in-loop -- sequential
      const aRecords = (await resolve($domain, 'A'));
      if (aRecords.answers.length !== 0) {
        domainAliveMap.set(domain, true);
        return [domain, true] as const;
      }

      aDns.push(aRecords.dns);
    }
    for (let i = 0; i < 2; i++) {
      // eslint-disable-next-line no-await-in-loop -- sequential
      const aaaaRecords = (await resolve($domain, 'AAAA'));
      if (aaaaRecords.answers.length !== 0) {
        domainAliveMap.set(domain, true);
        return [domain, true] as const;
      }

      aaaaDns.push(aaaaRecords.dns);
    }

    console.log(picocolors.red('[domain dead]'), 'no A/AAAA records', { domain, a: aDns, aaaa: aaaaDns });
  }

  domainAliveMap.set($domain, false);
  return [domain, false] as const;
}

export async function runAgainstRuleset(filepath: string) {
  const extname = path.extname(filepath);
  if (extname !== '.conf') {
    console.log('[skip]', filepath);
    return;
  }

  const promises: Array<Promise<[string, boolean]>> = [];

  for await (const l of readFileByLine(filepath)) {
    const line = processLine(l);
    if (!line) continue;
    const [type, domain] = line.split(',');
    switch (type) {
      case 'DOMAIN-SUFFIX':
      case 'DOMAIN': {
        promises.push(keyedAsyncMutexWithQueue(domain, () => isDomainAlive(domain, type === 'DOMAIN-SUFFIX')));
        break;
      }
      // no default
    }
  }

  await Promise.all(promises);
  console.log('[done]', filepath);
}

export async function runAgainstDomainset(filepath: string) {
  const extname = path.extname(filepath);
  if (extname !== '.conf') {
    console.log('[skip]', filepath);
    return;
  }

  const promises: Array<Promise<[string, boolean]>> = [];

  for await (const l of readFileByLine(filepath)) {
    const line = processLine(l);
    if (!line) continue;
    promises.push(keyedAsyncMutexWithQueue(line, () => isDomainAlive(line, line[0] === '.')));
  }

  await Promise.all(promises);
  console.log('[done]', filepath);
}
