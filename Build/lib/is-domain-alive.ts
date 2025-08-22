import { createDomainAliveChecker, createRegisterableDomainAliveChecker } from 'domain-alive';

const dnsServers = [
  '8.8.8.8',
  '8.8.4.4',
  '1.0.0.1',
  '1.1.1.1',
  '162.159.36.1',
  '162.159.46.1',
  'dns.cloudflare.com', // Cloudflare DoH that uses different IPs
  // one.one.one.one // Cloudflare DoH that uses 1.1.1.1 and 1.0.0.1
  // '101.101.101.101', // TWNIC, has DNS pollution, e.g. t66y.com
  '185.222.222.222', // DNS.SB
  '45.11.45.11', // DNS.SB
  'doh.dns.sb', // DNS.SB, Unicast PoPs w/ GeoDNS
  // 'doh.sb', // DNS.SB xTom Anycast IP
  // 'dns.sb', // DNS.SB use same xTom Anycast IP as doh.sb
  'dns10.quad9.net', // Quad9 unfiltered
  'doh.sandbox.opendns.com', // OpenDNS sandbox (unfiltered)
  'unfiltered.adguard-dns.com',
  'v.recipes', // Proxy Cloudflare
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
  'dns.mullvad.net',
  'basic.rethinkdns.com',
  'doh.qis.io',
  'dns.surfsharkdns.com',
  'private.canadianshield.cira.ca',
  'unfiltered.joindns4.eu',
  'public.dns.iij.jp',
  'doh.libredns.gr',
  'common.dot.dns.yandex.net'
  // '198.54.117.10' // NameCheap DNS, supports DoT, DoH, UDP53
  // 'ada.openbld.net',
  // 'dns.rabbitdns.org'
].map(dns => 'https://' + dns + '/dns-query');

const resultCache = new Map();
const registerableDomainResultCache = new Map();

export const isRegisterableDomainAlive = createRegisterableDomainAliveChecker({
  dns: {
    dnsServers
  },
  registerableDomainResultCache
});

export const isDomainAlive = createDomainAliveChecker({
  dns: {
    dnsServers
  },
  registerableDomainResultCache,
  resultCache
});
