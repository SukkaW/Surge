// @ts-check
import path from 'path';
import { createRuleset } from './lib/create-file';
import { fetchRemoteTextByLine, readFileIntoProcessedArray } from './lib/fetch-text-by-line';
import { task } from './trace';
import { SHARED_DESCRIPTION } from './lib/constants';
import { isProbablyIpv4, isProbablyIpv6 } from './lib/is-fast-ip';
import { TTL, deserializeArray, fsCache, serializeArray } from './lib/cache-filesystem';

const URL = 'https://raw.githubusercontent.com/felixonmars/dnsmasq-china-list/master/bogus-nxdomain.china.conf';

const getBogusNxDomainIPsPromise = fsCache.apply(
  URL,
  async () => {
    const result: string[] = [];
    for await (const line of await fetchRemoteTextByLine(URL)) {
      if (line && line.startsWith('bogus-nxdomain=')) {
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

export const buildAntiBogusDomain = task(import.meta.path, async (span) => {
  const result: string[] = await readFileIntoProcessedArray(path.resolve(import.meta.dir, '../Source/ip/reject.conf'));
  result.push(...(await getBogusNxDomainIPsPromise));

  const description = [
    ...SHARED_DESCRIPTION,
    '',
    'This file contains known addresses that are hijacking NXDOMAIN results returned by DNS servers.',
    '',
    'Data from:',
    ' - https://github.com/felixonmars/dnsmasq-china-list'
  ];

  return createRuleset(
    span,
    'Sukka\'s Ruleset - Anti Bogus Domain',
    description,
    new Date(),
    result,
    'ruleset',
    path.resolve(import.meta.dir, '../List/ip/reject.conf'),
    path.resolve(import.meta.dir, '../Clash/ip/reject.txt')
  );
});

if (import.meta.main) {
  buildAntiBogusDomain();
}
