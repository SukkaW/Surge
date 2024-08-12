// @ts-check
import path from 'path';
import { DOMESTICS } from '../Source/non_ip/domestic';
import { DIRECTS, LANS } from '../Source/non_ip/direct';
import { readFileIntoProcessedArray } from './lib/fetch-text-by-line';
import { compareAndWriteFile, createRuleset } from './lib/create-file';
import { task } from './trace';
import { SHARED_DESCRIPTION } from './lib/constants';
import { createMemoizedPromise } from './lib/memo-promise';
import * as yaml from 'yaml';
import { appendArrayInPlace } from './lib/append-array-in-place';
import { writeFile } from './lib/misc';

export const getDomesticAndDirectDomainsRulesetPromise = createMemoizedPromise(async () => {
  const domestics = await readFileIntoProcessedArray(path.resolve(__dirname, '../Source/non_ip/domestic.conf'));
  const directs = await readFileIntoProcessedArray(path.resolve(__dirname, '../Source/non_ip/direct.conf'));
  const lans: string[] = [];

  Object.entries(DOMESTICS).forEach(([, { domains }]) => {
    appendArrayInPlace(domestics, domains.map((domain) => `DOMAIN-SUFFIX,${domain}`));
  });
  Object.entries(DIRECTS).forEach(([, { domains }]) => {
    appendArrayInPlace(directs, domains.map((domain) => `DOMAIN-SUFFIX,${domain}`));
  });
  Object.entries(LANS).forEach(([, { domains }]) => {
    appendArrayInPlace(lans, domains.map((domain) => `DOMAIN-SUFFIX,${domain}`));
  });

  return [domestics, directs, lans] as const;
});

export const buildDomesticRuleset = task(require.main === module, __filename)(async (span) => {
  const res = await getDomesticAndDirectDomainsRulesetPromise();

  const dataset = Object.entries(DOMESTICS);
  appendArrayInPlace(dataset, Object.entries(DIRECTS));
  appendArrayInPlace(dataset, Object.entries(LANS));

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
      path.resolve(__dirname, '../List/non_ip/domestic.conf'),
      path.resolve(__dirname, '../Clash/non_ip/domestic.txt'),
      path.resolve(__dirname, '../sing-box/non_ip/domestic.json')
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
      path.resolve(__dirname, '../List/non_ip/direct.conf'),
      path.resolve(__dirname, '../Clash/non_ip/direct.txt'),
      path.resolve(__dirname, '../sing-box/non_ip/direct.json')
    ),
    createRuleset(
      span,
      'Sukka\'s Ruleset - LAN',
      [
        ...SHARED_DESCRIPTION,
        '',
        'This file includes rules for LAN DOMAIN and reserved TLDs.'
      ],
      new Date(),
      res[2],
      'ruleset',
      path.resolve(__dirname, '../List/non_ip/lan.conf'),
      path.resolve(__dirname, '../Clash/non_ip/lan.txt'),
      path.resolve(__dirname, '../sing-box/non_ip/lan.json')
    ),
    compareAndWriteFile(
      span,
      [
        '#!name=[Sukka] Local DNS Mapping',
        `#!desc=Last Updated: ${new Date().toISOString()}`,
        '',
        '[Host]',
        ...dataset.flatMap(([, { domains, dns, hosts }]) => [
          ...Object.entries(hosts).flatMap(([dns, ips]: [dns: string, ips: string[]]) => `${dns} = ${ips.join(', ')}`),
          ...domains.flatMap((domain) => [
            `${domain} = server:${dns}`,
            `*.${domain} = server:${dns}`
          ])
        ])
      ],
      path.resolve(__dirname, '../Modules/sukka_local_dns_mapping.sgmodule')
    ),
    writeFile(
      path.resolve(__dirname, '../Internal/clash_nameserver_policy.yaml'),
      yaml.stringify(
        {
          dns: {
            'nameserver-policy': dataset.reduce<Record<string, string | string[]>>(
              (acc, [, { domains, dns }]) => {
                domains.forEach((domain) => {
                  acc[`+.${domain}`] = dns === 'system'
                    ? [
                      'system://',
                      'system',
                      'dhcp://system'
                    ]
                    : dns;
                });

                return acc;
              },
              {}
            )
          },
          hosts: dataset.reduce<Record<string, string>>(
            (acc, [, { domains, dns, ...rest }]) => {
              if ('hosts' in rest) {
                Object.assign(acc, rest.hosts);
              }
              return acc;
            },
            {}
          )
        },
        { version: '1.1' }
      )
    )
  ]);
});
