// @ts-check
import path from 'path';
import { createRuleset } from './lib/create-file';
import { parseFelixDnsmasq } from './lib/parse-dnsmasq';
import { task } from './trace';
import { SHARED_DESCRIPTION } from './lib/constants';
import { createMemoizedPromise } from './lib/memo-promise';
import { TTL, deserializeArray, fsFetchCache, serializeArray } from './lib/cache-filesystem';

export const getAppleCdnDomainsPromise = createMemoizedPromise(() => fsFetchCache.apply(
  'https://raw.githubusercontent.com/felixonmars/dnsmasq-china-list/master/apple.china.conf',
  () => parseFelixDnsmasq('https://raw.githubusercontent.com/felixonmars/dnsmasq-china-list/master/apple.china.conf'),
  {
    ttl: TTL.THREE_DAYS(),
    serializer: serializeArray,
    deserializer: deserializeArray
  }
));

export const buildAppleCdn = task(typeof Bun !== 'undefined' ? Bun.main === __filename : require.main === module, __filename)(async (span) => {
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
      path.resolve(__dirname, '../List/non_ip/apple_cdn.conf'),
      path.resolve(__dirname, '../Clash/non_ip/apple_cdn.txt')
    ),
    createRuleset(
      span,
      'Sukka\'s Ruleset - Apple CDN',
      description,
      new Date(),
      domainset,
      'domainset',
      path.resolve(__dirname, '../List/domainset/apple_cdn.conf'),
      path.resolve(__dirname, '../Clash/domainset/apple_cdn.txt')
    )
  ]);
});
