import { createDomainAliveChecker, createRegisterableDomainAliveChecker } from 'domain-alive';
import { $$fetch } from './fetch-retry';

const dnsServers = [
  '8.8.8.8', '8.8.4.4',
  '1.0.0.1', '1.1.1.1',
  '162.159.36.1', '162.159.46.1',
  'dns.cloudflare.com', // Cloudflare DoH that uses different IPs: 172.64.41.8,162.159.61.8
  'cloudflare-dns.com', // Cloudflare DoH that uses different IPs: 104.16.249.249,104.16.248.249
  // one.one.one.one // Cloudflare DoH that uses 1.1.1.1 and 1.0.0.1
  // '101.101.101.101', // TWNIC, has DNS pollution, e.g. t66y.com
  '185.222.222.222', '45.11.45.11', // DNS.SB
  'doh.dns.sb', // DNS.SB, Unicast PoPs w/ GeoDNS
  // 'doh.sb', // DNS.SB xTom Anycast IP
  // 'dns.sb', // DNS.SB use same xTom Anycast IP as doh.sb
  'dns10.quad9.net', // Quad9 unfiltered
  'doh.sandbox.opendns.com', // OpenDNS sandbox (unfiltered)
  'unfiltered.adguard-dns.com',
  // 'v.recipes', // Proxy Cloudflare, too many HTTP 503
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
  // 'dns.mullvad.net', empty HTTP body a lot
  'basic.rethinkdns.com',
  'dns.surfsharkdns.com',
  'private.canadianshield.cira.ca',
  // 'unfiltered.joindns4.eu', // too many ECONNRESET on GitHub Actions
  'public.dns.iij.jp',
  // 'common.dot.dns.yandex.net', // too many ECONNRESET on GitHub Actions
  'safeservedns.com' // NameCheap DNS, supports DoT, DoH, UDP53
  // 'ada.openbld.net',
  // 'dns.rabbitdns.org'
].map(dns => 'https://' + dns + '/dns-query');

const resultCache = new Map();
const registerableDomainResultCache = new Map();

export async function getMethods() {
  const customWhoisServersMapping = await (await ($$fetch('https://cdn.jsdelivr.net/npm/whois-servers-list@latest/list.json'))).json() as any;

  const isRegisterableDomainAlive = createRegisterableDomainAliveChecker({
    dns: {
      dnsServers,
      maxAttempts: 6
    },
    registerableDomainResultCache,
    whois: {
      customWhoisServersMapping
    }
  });

  const isDomainAlive = createDomainAliveChecker({
    dns: {
      dnsServers,
      maxAttempts: 6
    },
    registerableDomainResultCache,
    resultCache,
    whois: {
      customWhoisServersMapping
    }
  });

  return { isRegisterableDomainAlive, isDomainAlive };
};
