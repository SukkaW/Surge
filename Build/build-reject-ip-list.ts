// @ts-check
import path from 'node:path';
import { fetchRemoteTextByLine, readFileIntoProcessedArray } from './lib/fetch-text-by-line';
import { task } from './trace';
import { SHARED_DESCRIPTION } from './lib/constants';
import { isProbablyIpv4, isProbablyIpv6 } from './lib/is-fast-ip';
import { TTL, fsFetchCache, createCacheKey } from './lib/cache-filesystem';
import { fetchAssets } from './lib/fetch-assets';
import { processLine } from './lib/process-line';
import { RulesetOutput } from './lib/create-file';
import { SOURCE_DIR } from './constants/dir';

const cacheKey = createCacheKey(__filename);

const BOGUS_NXDOMAIN_URL = 'https://raw.githubusercontent.com/felixonmars/dnsmasq-china-list/master/bogus-nxdomain.china.conf';

const getBogusNxDomainIPsPromise = fsFetchCache.apply<[ipv4: string[], ipv6: string[]]>(
  cacheKey(BOGUS_NXDOMAIN_URL),
  async () => {
    const ipv4: string[] = [];
    const ipv6: string[] = [];
    for await (const line of await fetchRemoteTextByLine(BOGUS_NXDOMAIN_URL)) {
      if (line.startsWith('bogus-nxdomain=')) {
        const ip = line.slice(15).trim();
        if (isProbablyIpv4(ip)) {
          ipv4.push(ip);
        } else if (isProbablyIpv6(ip)) {
          ipv6.push(ip);
        }
      }
    }
    return [ipv4, ipv6] as const;
  },
  {
    ttl: TTL.ONE_WEEK(),
    serializer: JSON.stringify,
    deserializer: JSON.parse
  }
);

const BOTNET_FILTER_URL = 'https://curbengh.github.io/botnet-filter/botnet-filter-dnscrypt-blocked-ips.txt';
const BOTNET_FILTER_MIRROR_URL = [
  'https://curbengh.github.io/malware-filter/botnet-filter-dnscrypt-blocked-ips.txt',
  'https://malware-filter.gitlab.io/malware-filter/botnet-filter-dnscrypt-blocked-ips.txt',
  'https://malware-filter.pages.dev/botnet-filter-dnscrypt-blocked-ips.txt'
];

const getBotNetFilterIPsPromise = fsFetchCache.apply<[ipv4: string[], ipv6: string[]]>(
  cacheKey(BOTNET_FILTER_URL),
  async () => {
    const text = await fetchAssets(BOTNET_FILTER_URL, BOTNET_FILTER_MIRROR_URL);
    return text.split('\n').reduce<[ipv4: string[], ipv6: string[]]>((acc, cur) => {
      const ip = processLine(cur);
      if (ip) {
        if (isProbablyIpv4(ip)) {
          acc[0].push(ip);
        } else if (isProbablyIpv6(ip)) {
          acc[1].push(ip);
        }
      }
      return acc;
    }, [[], []]);
  },
  {
    ttl: TTL.TWLVE_HOURS(),
    serializer: JSON.stringify,
    deserializer: JSON.parse
  }
);

export const buildRejectIPList = task(require.main === module, __filename)(async (span) => {
  const [bogusNxDomainIPs, botNetIPs] = await Promise.all([
    span.traceChildPromise('get bogus nxdomain ips', getBogusNxDomainIPsPromise),
    span.traceChildPromise('get botnet ips', getBotNetFilterIPsPromise)
  ]);

  return new RulesetOutput(span, 'reject', 'ip')
    .withTitle('Sukka\'s Ruleset - Anti Bogus Domain')
    .withDescription([
      ...SHARED_DESCRIPTION,
      '',
      'This file contains known addresses that are hijacking NXDOMAIN results returned by DNS servers, and botnet controller IPs.',
      '',
      'Data from:',
      ' - https://github.com/felixonmars/dnsmasq-china-list',
      ' - https://github.com/curbengh/botnet-filter'
    ])
    .addFromRuleset(await readFileIntoProcessedArray(path.resolve(SOURCE_DIR, 'ip/reject.conf')))
    .bulkAddCIDR4NoResolve(bogusNxDomainIPs[0])
    .bulkAddCIDR6NoResolve(bogusNxDomainIPs[1])
    .bulkAddCIDR4NoResolve(botNetIPs[0])
    .bulkAddCIDR6NoResolve(botNetIPs[1])
    .write();
});
