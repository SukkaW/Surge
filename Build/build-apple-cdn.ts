// @ts-check
import { createRuleset } from './lib/create-file';
import { parseFelixDnsmasq } from './lib/parse-dnsmasq';
import { task } from './trace';
import { SHARED_DESCRIPTION } from './lib/constants';
import { createMemoizedPromise } from './lib/memo-promise';
import { TTL, deserializeArray, fsFetchCache, serializeArray, createCacheKey } from './lib/cache-filesystem';
import { output } from './lib/misc';

const cacheKey = createCacheKey(__filename);

const url = 'https://raw.githubusercontent.com/felixonmars/dnsmasq-china-list/master/apple.china.conf';
export const getAppleCdnDomainsPromise = createMemoizedPromise(() => fsFetchCache.apply(
  cacheKey(url),
  () => parseFelixDnsmasq(url),
  {
    ttl: TTL.THREE_DAYS(),
    serializer: serializeArray,
    deserializer: deserializeArray
  }
));

export const buildAppleCdn = task(require.main === module, __filename)(async (span) => {
  const res: string[] = await span.traceChildPromise('get apple cdn domains', getAppleCdnDomainsPromise());

  const description = [
    ...SHARED_DESCRIPTION,
    '',
    'This file contains Apple\'s domains using their China mainland CDN servers.',
    '',
    'Data from:',
    ' - https://github.com/felixonmars/dnsmasq-china-list'
  ];

  const ruleset = res.map(domain => `DOMAIN-SUFFIX,${domain}`);
  const domainset = res.map(i => `.${i}`);

  return Promise.all([
    createRuleset(
      span,
      'Sukka\'s Ruleset - Apple CDN',
      description,
      new Date(),
      ruleset,
      'ruleset',
      output('apple_cdn', 'non_ip')
    ),
    createRuleset(
      span,
      'Sukka\'s Ruleset - Apple CDN',
      description,
      new Date(),
      domainset,
      'domainset',
      output('apple_cdn', 'domainset')
    )
  ]);
});
