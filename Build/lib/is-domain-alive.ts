import { createDomainAliveChecker, createRegisterableDomainAliveChecker } from 'domain-alive';
import { $$fetch } from './fetch-retry';

const dnsServers = [
  'https://8.8.8.8/dns-query', 'https://8.8.4.4/dns-query',
  'https://1.0.0.1/dns-query', 'https://1.1.1.1/dns-query',
  'https://162.159.36.1/dns-query', 'https://162.159.46.1/dns-query',
  'https://dns.cloudflare.com/dns-query', // Cloudflare DoH that uses different IPs: 172.64.41.8,162.159.61.8
  'https://cloudflare-dns.com/dns-query', // Cloudflare DoH that uses different IPs: 104.16.249.249,104.16.248.249
  'https://mozilla.cloudflare-dns.com/dns-query', // Cloudflare DoH that uses different IPs: 162.159.61.4,172.64.41.4
  // one.one.one.one // Cloudflare DoH that uses 1.1.1.1 and 1.0.0.1
  // 'https://101.101.101.101/dns-query', 'https://dns.twnic.tw/dns-query' // TWNIC, has DNS pollution, e.g. t66y.com
  // 'https://dns.hinet.net/dns-query' // HiNet DoH, has DNS pollution, e.g. t66y.com
  'https://185.222.222.222/dns-query', 'https://45.11.45.11/dns-query', // DNS.SB
  // 'https://doh.dns.sb/dns-query', // DNS.SB, Unicast PoPs w/ GeoDNS
  'https://us-chi.doh.sb/dns-query', // DNS.SB Chicago PoP
  'https://us-nyc.doh.sb/dns-query', // DNS.SB New York City PoP
  'https://us-sjc.doh.sb/dns-query', // DNS.SB San Jose PoP
  // 'https://doh.sb/dns-query', // DNS.SB xTom Anycast IP
  // 'https://dns.sb/dns-query', // DNS.SB use same xTom Anycast IP as doh.sb
  // 'https://dns10.quad9.net/dns-query', // Quad9 unfiltered
  'https://9.9.9.10/dns-query', 'https://149.112.112.10/dns-query', // Quad9 unfiltered
  'https://doh.sandbox.opendns.com/dns-query', // OpenDNS sandbox (unfiltered)
  'https://unfiltered.adguard-dns.com/dns-query', // AdGuard unfiltered
  // 'https://v.recipes/dns-query', // Proxy Cloudflare, too many HTTP 503
  'https://v.recipes/dns/dns.google/dns-query', // Proxy Google, claims to not limited by Google 1500 QPS limit
  'https://freedns.controld.com/p0', // ControlD unfiltered
  'https://dns.bebasid.com/unfiltered', // BebasID
  // 'https://193.110.81.0/dns-query', // dns0.eu
  // 'https://185.253.5.0/dns-query', // dns0.eu
  // 'https://zero.dns0.eu/dns-query',
  'https://dns.nextdns.io/dns-query',
  'https://anycast.dns.nextdns.io/dns-query',
  'https://wikimedia-dns.org/dns-query',
  // 'https://ordns.he.net/dns-query',
  // 'https://dns.mullvad.net/dns-query', empty HTTP body a lot
  'https://basic.rethinkdns.com/dns-query',
  'https://dns.surfsharkdns.com/dns-query',
  // 'https://private.canadianshield.cira.ca/dns-query', enforce HTTP/2
  // 'https://unfiltered.joindns4.eu/dns-query', // too many ECONNRESET on GitHub Actions
  'https://public.dns.iij.jp/dns-query',
  // 'https://common.dot.dns.yandex.net/dns-query', // too many ECONNRESET on GitHub Actions
  'https://safeservedns.com/dns-query' // NameCheap DNS, supports DoT, DoH, UDP53
  // 'https://ada.openbld.net/dns-query', Contains filtering
  // 'https://dns.rabbitdns.org/dns-query'
];

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
