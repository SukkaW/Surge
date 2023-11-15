// @ts-check
import path from 'path';
import { DOMESTICS } from '../Source/non_ip/domestic';
import { readFileByLine } from './lib/fetch-remote-text-by-line';
import { processLineFromReadline } from './lib/process-line';
import { compareAndWriteFile, createRuleset } from './lib/create-file';
import { task } from './lib/trace-runner';

export const buildDomesticRuleset = task(__filename, async () => {
  const results = await processLineFromReadline(readFileByLine(path.resolve(__dirname, '../Source/non_ip/domestic.conf')));

  results.push(
    ...Object.entries(DOMESTICS)
      .reduce<string[]>(
        (acc, [key, { domains }]) => {
          if (key === 'SYSTEM') return acc;
          return [...acc, ...domains];
        },
        []
      )
      .map((domain) => `DOMAIN-SUFFIX,${domain}`)
  );

  const rulesetDescription = [
    'License: AGPL 3.0',
    'Homepage: https://ruleset.skk.moe',
    'GitHub: https://github.com/SukkaW/Surge',
    '',
    'This file contains known addresses that are avaliable in the Mainland China.'
  ];

  return Promise.all([
    ...createRuleset(
      'Sukka\'s Ruleset - Domestic Domains',
      rulesetDescription,
      new Date(),
      results,
      'ruleset',
      path.resolve(__dirname, '../List/non_ip/domestic.conf'),
      path.resolve(__dirname, '../Clash/non_ip/domestic.txt')
    ),
    compareAndWriteFile(
      [
        '#!name=[Sukka] Local DNS Mapping',
        `#!desc=Last Updated: ${new Date().toISOString()}`,
        '',
        '[Host]',
        ...Object.entries(DOMESTICS)
          .flatMap(
            ([, { domains, dns }]) => domains.flatMap((domain) => [
              `${domain} = server:${dns}`,
              `*.${domain} = server:${dns}`
            ])
          )
      ],
      path.resolve(__dirname, '../Modules/sukka_local_dns_mapping.sgmodule')
    )
  ]);
});

if (import.meta.main) {
  buildDomesticRuleset();
}
