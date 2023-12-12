// @ts-check
import path from 'path';
import { createRuleset } from './lib/create-file';
import { parseFelixDnsmasq } from './lib/parse-dnsmasq';
import { task, traceAsync } from './lib/trace-runner';
import { SHARED_DESCRIPTION } from './lib/constants';
import picocolors from 'picocolors';

export const buildAppleCdn = task(import.meta.path, async () => {
  const res = await traceAsync(
    picocolors.gray('download dnsmasq-china-list apple.china.conf'),
    () => parseFelixDnsmasq('https://raw.githubusercontent.com/felixonmars/dnsmasq-china-list/master/apple.china.conf'),
    picocolors.gray
  );

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
    ...createRuleset(
      'Sukka\'s Ruleset - Apple CDN',
      description,
      new Date(),
      ruleset,
      'ruleset',
      path.resolve(import.meta.dir, '../List/non_ip/apple_cdn.conf'),
      path.resolve(import.meta.dir, '../Clash/non_ip/apple_cdn.txt')
    ),
    ...createRuleset(
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
