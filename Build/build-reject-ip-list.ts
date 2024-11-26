// @ts-check
import path from 'node:path';
import { createReadlineInterfaceFromResponse, readFileIntoProcessedArray } from './lib/fetch-text-by-line';
import { task } from './trace';
import { SHARED_DESCRIPTION } from './constants/description';
import { isProbablyIpv4, isProbablyIpv6 } from './lib/is-fast-ip';
import { fsFetchCache, getFileContentHash } from './lib/cache-filesystem';
import { processLine } from './lib/process-line';
import { RulesetOutput } from './lib/create-file';
import { SOURCE_DIR } from './constants/dir';
import { $fetch } from './lib/make-fetch-happen';

const BOGUS_NXDOMAIN_URL = 'https://raw.githubusercontent.com/felixonmars/dnsmasq-china-list/master/bogus-nxdomain.china.conf';
const getBogusNxDomainIPsPromise: Promise<[ipv4: string[], ipv6: string[]]> = $fetch(BOGUS_NXDOMAIN_URL).then(async (resp) => {
  const ipv4: string[] = [];
  const ipv6: string[] = [];

  for await (const line of createReadlineInterfaceFromResponse(resp, true)) {
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
});

const BOTNET_FILTER_URL = 'https://malware-filter.pages.dev/botnet-filter-dnscrypt-blocked-ips.txt';
const BOTNET_FILTER_MIRROR_URL = [
  'https://botnet-filter.pages.dev/botnet-filter-dnscrypt-blocked-ips.txt',
  'https://malware-filter.gitlab.io/malware-filter/botnet-filter-dnscrypt-blocked-ips.txt',
  'https://malware-filter.gitlab.io/botnet-filter/botnet-filter-dnscrypt-blocked-ips.txt'
  // 'https://curbengh.github.io/botnet-filter/botnet-filter-dnscrypt-blocked-ips.txt',
  // https://curbengh.github.io/malware-filter/botnet-filter-dnscrypt-blocked-ips.txt
];

const getBotNetFilterIPsPromise = fsFetchCache.applyWithHttp304AndMirrors<[ipv4: string[], ipv6: string[]]>(
  BOTNET_FILTER_URL,
  BOTNET_FILTER_MIRROR_URL,
  getFileContentHash(__filename),
  (text) => text.split('\n').reduce<[ipv4: string[], ipv6: string[]]>((acc, cur) => {
    const ip = processLine(cur);
    if (ip) {
      if (isProbablyIpv4(ip)) {
        acc[0].push(ip);
      } else if (isProbablyIpv6(ip)) {
        acc[1].push(ip);
      }
    }
    return acc;
  }, [[], []]),
  {
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
