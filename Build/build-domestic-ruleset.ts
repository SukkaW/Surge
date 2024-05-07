// @ts-check
import path from 'path';
import { DOMESTICS } from '../Source/non_ip/domestic';
import { readFileIntoProcessedArray } from './lib/fetch-text-by-line';
import { compareAndWriteFile, createRuleset } from './lib/create-file';
import { task } from './trace';
import { SHARED_DESCRIPTION } from './lib/constants';
import { createMemoizedPromise } from './lib/memo-promise';

export const getDomesticDomainsRulesetPromise = createMemoizedPromise(async () => {
  const results = await readFileIntoProcessedArray(path.resolve(import.meta.dir, '../Source/non_ip/domestic.conf'));

  results.push(
    ...Object.entries(DOMESTICS).reduce<string[]>((acc, [key, { domains }]) => {
      if (key === 'SYSTEM') return acc;
      return [...acc, ...domains];
    }, []).map((domain) => `DOMAIN-SUFFIX,${domain}`)
  );

  return results;
});

export const buildDomesticRuleset = task(import.meta.path, async (span) => {
  const rulesetDescription = [
    ...SHARED_DESCRIPTION,
    '',
    'This file contains known addresses that are avaliable in the Mainland China.'
  ];

  const res = await getDomesticDomainsRulesetPromise();

  return Promise.all([
    createRuleset(
      span,
      'Sukka\'s Ruleset - Domestic Domains',
      rulesetDescription,
      new Date(),
      res,
      'ruleset',
      path.resolve(import.meta.dir, '../List/non_ip/domestic.conf'),
      path.resolve(import.meta.dir, '../Clash/non_ip/domestic.txt')
    ),
    compareAndWriteFile(
      span,
      [
        '#!name=[Sukka] Local DNS Mapping',
        `#!desc=Last Updated: ${new Date().toISOString()}`,
        '',
        '[Host]',
        ...Object.entries(DOMESTICS)
          .flatMap(
            ([, { domains, dns, ...rest }]) => [
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

if (import.meta.main) {
  buildDomesticRuleset();
}
