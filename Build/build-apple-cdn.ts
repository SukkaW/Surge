// @ts-check
import path from 'path';
import { createRuleset } from './lib/create-file';
import { parseFelixDnsmasq } from './lib/parse-dnsmasq';
import { traceAsync } from './lib/trace-runner';
import { task } from './trace';
import { SHARED_DESCRIPTION } from './lib/constants';
import picocolors from 'picocolors';
import { createMemoizedPromise } from './lib/memo-promise';
import { TTL, deserializeArray, fsCache, serializeArray } from './lib/cache-filesystem';

export const getAppleCdnDomainsPromise = createMemoizedPromise(() => traceAsync(
  picocolors.gray('download dnsmasq-china-list apple.china.conf'),
  () => fsCache.apply(
    'https://raw.githubusercontent.com/felixonmars/dnsmasq-china-list/master/apple.china.conf',
    () => parseFelixDnsmasq('https://raw.githubusercontent.com/felixonmars/dnsmasq-china-list/master/apple.china.conf'),
    {
      ttl: TTL.THREE_DAYS(),
      serializer: serializeArray,
      deserializer: deserializeArray
    }
  ),
  picocolors.gray
));

export const buildAppleCdn = task(import.meta.path, async (span) => {
  const res = await getAppleCdnDomainsPromise();

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
      path.resolve(import.meta.dir, '../List/non_ip/apple_cdn.conf'),
      path.resolve(import.meta.dir, '../Clash/non_ip/apple_cdn.txt')
    ),
    createRuleset(
      span,
      'Sukka\'s Ruleset - Apple CDN',
      description,
      new Date(),
      domainset,
      'domainset',
      path.resolve(import.meta.dir, '../List/domainset/apple_cdn.conf'),
      path.resolve(import.meta.dir, '../Clash/domainset/apple_cdn.txt')
    )
  ]);
});

if (import.meta.main) {
  buildAppleCdn();
}
