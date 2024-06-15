// @ts-check
import path from 'path';
import { DOMESTICS } from '../Source/non_ip/domestic';
import { DIRECTS } from '../Source/non_ip/direct';
import { readFileIntoProcessedArray } from './lib/fetch-text-by-line';
import { compareAndWriteFile, createRuleset } from './lib/create-file';
import { task } from './trace';
import { SHARED_DESCRIPTION } from './lib/constants';
import { createMemoizedPromise } from './lib/memo-promise';

export const getDomesticAndDirectDomainsRulesetPromise = createMemoizedPromise(async () => {
  const domestics = await readFileIntoProcessedArray(path.resolve(import.meta.dir, '../Source/non_ip/domestic.conf'));
  const directs = await readFileIntoProcessedArray(path.resolve(import.meta.dir, '../Source/non_ip/direct.conf'));

  Object.entries(DOMESTICS).forEach(([, { domains }]) => {
    domestics.push(...domains.map((domain) => `DOMAIN-SUFFIX,${domain}`));
  });
  Object.entries(DIRECTS).forEach(([, { domains }]) => {
    directs.push(...domains.map((domain) => `DOMAIN-SUFFIX,${domain}`));
  });

  return [domestics, directs] as const;
});

export const buildDomesticRuleset = task(import.meta.main, import.meta.path)(async (span) => {
  const res = await getDomesticAndDirectDomainsRulesetPromise();

  return Promise.all([
    createRuleset(
      span,
      'Sukka\'s Ruleset - Domestic Domains',
      [
        ...SHARED_DESCRIPTION,
        '',
        'This file contains known addresses that are avaliable in the Mainland China.'
      ],
      new Date(),
      res[0],
      'ruleset',
      path.resolve(import.meta.dir, '../List/non_ip/domestic.conf'),
      path.resolve(import.meta.dir, '../Clash/non_ip/domestic.txt')
    ),
    createRuleset(
      span,
      'Sukka\'s Ruleset - Direct Rules',
      [
        ...SHARED_DESCRIPTION,
        '',
        'This file contains domains and process that should not be proxied.'
      ],
      new Date(),
      res[1],
      'ruleset',
      path.resolve(import.meta.dir, '../List/non_ip/direct.conf'),
      path.resolve(import.meta.dir, '../Clash/non_ip/direct.txt')
    ),
    compareAndWriteFile(
      span,
      [
        '#!name=[Sukka] Local DNS Mapping',
        `#!desc=Last Updated: ${new Date().toISOString()}`,
        '',
        '[Host]',
        ...([...Object.entries(DOMESTICS), ...Object.entries(DIRECTS)])
          .flatMap(([, { domains, dns, ...rest }]) => [
            ...(
              'hosts' in rest
                ? Object.entries(rest.hosts).flatMap(([dns, ips]: [dns: string, ips: string[]]) => `${dns} = ${ips.join(', ')}`)
                : []
            ),
            ...domains.flatMap((domain) => [
              `${domain} = server:${dns}`,
              `*.${domain} = server:${dns}`
            ])
          ])
      ],
      path.resolve(import.meta.dir, '../Modules/sukka_local_dns_mapping.sgmodule')
    )
  ]);
});
