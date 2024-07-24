// @ts-check
import path from 'path';
import { createRuleset } from './lib/create-file';
import { fetchRemoteTextByLine, readFileIntoProcessedArray } from './lib/fetch-text-by-line';
import { task } from './trace';
import { SHARED_DESCRIPTION } from './lib/constants';
import { isProbablyIpv4, isProbablyIpv6 } from './lib/is-fast-ip';
import { TTL, deserializeArray, fsFetchCache, serializeArray } from './lib/cache-filesystem';
import { fetchAssets } from './lib/fetch-assets';
import { processLine } from './lib/process-line';
import { appendArrayInPlace } from './lib/append-array-in-place';

const BOGUS_NXDOMAIN_URL = 'https://raw.githubusercontent.com/felixonmars/dnsmasq-china-list/master/bogus-nxdomain.china.conf';

const getBogusNxDomainIPsPromise = fsFetchCache.apply(
  BOGUS_NXDOMAIN_URL,
  async () => {
    const result: string[] = [];
    for await (const line of await fetchRemoteTextByLine(BOGUS_NXDOMAIN_URL)) {
      if (line.startsWith('bogus-nxdomain=')) {
        const ip = line.slice(15).trim();
        if (isProbablyIpv4(ip)) {
          result.push(`IP-CIDR,${ip}/32,no-resolve`);
        } else if (isProbablyIpv6(ip)) {
          result.push(`IP-CIDR6,${ip}/128,no-resolve`);
        }
      }
    }
    return result;
  },
  {
    ttl: TTL.ONE_WEEK(),
    serializer: serializeArray,
    deserializer: deserializeArray
  }
);

const BOTNET_FILTER_URL = 'https://curbengh.github.io/botnet-filter/botnet-filter-dnscrypt-blocked-ips.txt';
const BOTNET_FILTER_MIRROR_URL = [
  'https://curbengh.github.io/malware-filter/botnet-filter-dnscrypt-blocked-ips.txt',
  'https://malware-filter.gitlab.io/malware-filter/botnet-filter-dnscrypt-blocked-ips.txt',
  'https://malware-filter.pages.dev/botnet-filter-dnscrypt-blocked-ips.txt'
];

const getBotNetFilterIPsPromise = fsFetchCache.apply(
  BOTNET_FILTER_URL,
  async () => {
    const text = await fetchAssets(BOTNET_FILTER_URL, BOTNET_FILTER_MIRROR_URL);
    return text.split('\n').reduce<string[]>((acc, cur) => {
      const ip = processLine(cur);
      if (ip) {
        if (isProbablyIpv4(ip)) {
          acc.push(`IP-CIDR,${ip}/32,no-resolve`);
        } else if (isProbablyIpv6(ip)) {
          acc.push(`IP-CIDR6,${ip}/128,no-resolve`);
        }
      }
      return acc;
    }, []);
  },
  {
    ttl: TTL.TWLVE_HOURS(),
    serializer: serializeArray,
    deserializer: deserializeArray
  }
);

const localRejectIPSourcesPromise = readFileIntoProcessedArray(path.resolve(__dirname, '../Source/ip/reject.conf'));

export const buildRejectIPList = task(require.main === module, __filename)(async (span) => {
  const result = await localRejectIPSourcesPromise;

  const bogusNxDomainIPs = await span.traceChildPromise('get bogus nxdomain ips', getBogusNxDomainIPsPromise);
  const botNetIPs = await span.traceChildPromise('get botnet ips', getBotNetFilterIPsPromise);

  appendArrayInPlace(result, bogusNxDomainIPs);
  appendArrayInPlace(result, botNetIPs);

  const description = [
    ...SHARED_DESCRIPTION,
    '',
    'This file contains known addresses that are hijacking NXDOMAIN results returned by DNS servers, and botnet controller IPs.',
    '',
    'Data from:',
    ' - https://github.com/felixonmars/dnsmasq-china-list',
    ' - https://github.com/curbengh/botnet-filter'
  ];

  return createRuleset(
    span,
    'Sukka\'s Ruleset - Anti Bogus Domain',
    description,
    new Date(),
    result,
    'ruleset',
    path.resolve(__dirname, '../List/ip/reject.conf'),
    path.resolve(__dirname, '../Clash/ip/reject.txt')
  );
});
