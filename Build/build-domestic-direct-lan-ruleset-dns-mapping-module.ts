// @ts-check
import path from 'node:path';
import { DOMESTICS } from '../Source/non_ip/domestic';
import { DIRECTS, LANS } from '../Source/non_ip/direct';
import { readFileIntoProcessedArray } from './lib/fetch-text-by-line';
import { compareAndWriteFile } from './lib/create-file';
import { task } from './trace';
import { SHARED_DESCRIPTION } from './lib/constants';
import { createMemoizedPromise } from './lib/memo-promise';
import * as yaml from 'yaml';
import { appendArrayInPlace } from './lib/append-array-in-place';
import { OUTPUT_INTERNAL_DIR, OUTPUT_MODULES_DIR, SOURCE_DIR } from './constants/dir';
import { RulesetOutput } from './lib/create-file';

const getRule = (domain: string) => {
  switch (domain[0]) {
    case '+':
    case '$':
      return `DOMAIN-SUFFIX,${domain.slice(1)}`;
    default:
      return `DOMAIN-SUFFIX,${domain}`;
  }
};
export const getDomesticAndDirectDomainsRulesetPromise = createMemoizedPromise(async () => {
  const domestics = await readFileIntoProcessedArray(path.join(SOURCE_DIR, 'non_ip/domestic.conf'));
  const directs = await readFileIntoProcessedArray(path.resolve(SOURCE_DIR, 'non_ip/direct.conf'));
  const lans: string[] = [];

  Object.entries(DOMESTICS).forEach(([, { domains }]) => {
    appendArrayInPlace(domestics, domains.map(getRule));
  });
  Object.entries(DIRECTS).forEach(([, { domains }]) => {
    appendArrayInPlace(directs, domains.map(getRule));
  });
  Object.entries(LANS).forEach(([, { domains }]) => {
    appendArrayInPlace(lans, domains.map(getRule));
  });

  return [domestics, directs, lans] as const;
});

export const buildDomesticRuleset = task(require.main === module, __filename)(async (span) => {
  const [domestics, directs, lans] = await getDomesticAndDirectDomainsRulesetPromise();

  const dataset = Object.entries(DOMESTICS);
  appendArrayInPlace(dataset, Object.entries(DIRECTS));
  appendArrayInPlace(dataset, Object.entries(LANS));

  return Promise.all([
    new RulesetOutput(span, 'domestic', 'non_ip')
      .withTitle('Sukka\'s Ruleset - Domestic Domains')
      .withDescription([
        ...SHARED_DESCRIPTION,
        '',
        'This file contains known addresses that are avaliable in the Mainland China.'
      ])
      .addFromRuleset(domestics)
      .write(),
    new RulesetOutput(span, 'direct', 'non_ip')
      .withTitle('Sukka\'s Ruleset - Direct Rules')
      .withDescription([
        ...SHARED_DESCRIPTION,
        '',
        'This file contains domains and process that should not be proxied.'
      ])
      .addFromRuleset(directs)
      .write(),
    new RulesetOutput(span, 'lan', 'non_ip')
      .withTitle('Sukka\'s Ruleset - LAN')
      .withDescription([
        ...SHARED_DESCRIPTION,
        '',
        'This file includes rules for LAN DOMAIN and reserved TLDs.'
      ])
      .addFromRuleset(lans)
      .write(),
    compareAndWriteFile(
      span,
      [
        '#!name=[Sukka] Local DNS Mapping',
        `#!desc=Last Updated: ${new Date().toISOString()}`,
        '',
        '[Host]',
        ...dataset.flatMap(([, { domains, dns, hosts }]) => [
          ...Object.entries(hosts).flatMap(([dns, ips]: [dns: string, ips: string[]]) => `${dns} = ${ips.join(', ')}`),
          ...domains.flatMap((domain) => {
            if (domain[0] === '$') {
              return [
                `${domain.slice(1)} = server:${dns}`
              ];
            }
            if (domain[0] === '+') {
              return [
                `*.${domain.slice(1)} = server:${dns}`
              ];
            }
            return [
              `${domain} = server:${dns}`,
              `*.${domain} = server:${dns}`
            ];
          })
        ])
      ],
      path.resolve(OUTPUT_MODULES_DIR, 'sukka_local_dns_mapping.sgmodule')
    ),
    compareAndWriteFile(
      span,
      yaml.stringify(
        {
          dns: {
            'nameserver-policy': dataset.reduce<Record<string, string | string[]>>(
              (acc, [, { domains, dns }]) => {
                domains.forEach((domain) => {
                  let domainWildcard = domain;
                  if (domain[0] === '$') {
                    domainWildcard = domain.slice(1);
                  } else if (domain[0] === '+') {
                    domainWildcard = `*.${domain.slice(1)}`;
                  } else {
                    domainWildcard = `+.${domain}`;
                  }

                  acc[domainWildcard] = dns === 'system'
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
      ).split('\n'),
      path.join(OUTPUT_INTERNAL_DIR, 'clash_nameserver_policy.yaml')
    )
  ]);
});
