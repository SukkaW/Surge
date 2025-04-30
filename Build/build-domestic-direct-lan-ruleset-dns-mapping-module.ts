// @ts-check
import path from 'node:path';
import { DOMESTICS, DOH_BOOTSTRAP, AdGuardHomeDNSMapping } from '../Source/non_ip/domestic';
import { DIRECTS, HOSTS, LAN } from '../Source/non_ip/direct';
import type { DNSMapping } from '../Source/non_ip/direct';
import { readFileIntoProcessedArray } from './lib/fetch-text-by-line';
import { compareAndWriteFile } from './lib/create-file';
import { task } from './trace';
import { SHARED_DESCRIPTION } from './constants/description';
import { createMemoizedPromise } from './lib/memo-promise';
import * as yaml from 'yaml';
import { appendArrayInPlace } from 'foxts/append-array-in-place';
import { OUTPUT_INTERNAL_DIR, OUTPUT_MODULES_DIR, OUTPUT_MODULES_RULES_DIR, SOURCE_DIR } from './constants/dir';
import { RulesetOutput } from './lib/rules/ruleset';
import { SurgeOnlyRulesetOutput } from './lib/rules/ruleset';

export function createGetDnsMappingRule(allowWildcard: boolean) {
  const hasWildcard = (domain: string) => {
    if (domain.includes('*') || domain.includes('?')) {
      if (!allowWildcard) {
        throw new TypeError(`Wildcard domain is not supported: ${domain}`);
      }
      return true;
    }

    return false;
  };

  return (domain: string): string[] => {
    const results: string[] = [];
    if (domain[0] === '$') {
      const d = domain.slice(1);
      if (hasWildcard(domain)) {
        results.push(`DOMAIN-WILDCARD,${d}`);
      } else {
        results.push(`DOMAIN,${d}`);
      }
    } else if (domain[0] === '+') {
      const d = domain.slice(1);
      if (hasWildcard(domain)) {
        results.push(`DOMAIN-WILDCARD,*.${d}`);
      } else {
        results.push(`DOMAIN-SUFFIX,${d}`);
      }
    } else if (hasWildcard(domain)) {
      results.push(`DOMAIN-WILDCARD,${domain}`, `DOMAIN-WILDCARD,*.${domain}`);
    } else {
      results.push(`DOMAIN-SUFFIX,${domain}`);
    }

    return results;
  };
}

export const getDomesticAndDirectDomainsRulesetPromise = createMemoizedPromise(async () => {
  const domestics = await readFileIntoProcessedArray(path.join(SOURCE_DIR, 'non_ip/domestic.conf'));
  const directs = await readFileIntoProcessedArray(path.resolve(SOURCE_DIR, 'non_ip/direct.conf'));
  const lans: string[] = [];

  const getDnsMappingRuleWithWildcard = createGetDnsMappingRule(true);

  [DOH_BOOTSTRAP, DOMESTICS].forEach((item) => {
    Object.values(item).forEach(({ domains }) => {
      appendArrayInPlace(domestics, domains.flatMap(getDnsMappingRuleWithWildcard));
    });
  });

  Object.values(DIRECTS).forEach(({ domains }) => {
    appendArrayInPlace(directs, domains.flatMap(getDnsMappingRuleWithWildcard));
  });

  Object.values(LAN).forEach(({ domains }) => {
    appendArrayInPlace(directs, domains.flatMap(getDnsMappingRuleWithWildcard));
  });

  // backward compatible, add lan.conf
  Object.values(LAN).forEach(({ domains }) => {
    appendArrayInPlace(lans, domains.flatMap(getDnsMappingRuleWithWildcard));
  });

  return [domestics, directs, lans] as const;
});

export const buildDomesticRuleset = task(require.main === module, __filename)(async (span) => {
  const [domestics, directs, lans] = await getDomesticAndDirectDomainsRulesetPromise();

  const dataset: Array<[name: string, DNSMapping]> = ([DOH_BOOTSTRAP, DOMESTICS, DIRECTS, LAN, HOSTS] as const).flatMap(Object.entries);

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

    ...dataset.map(([name, { ruleset, domains }]) => {
      if (!ruleset) {
        return;
      }

      const output = new SurgeOnlyRulesetOutput(span, name.toLowerCase(), 'sukka_local_dns_mapping', OUTPUT_MODULES_RULES_DIR)
        .withTitle(`Sukka's Ruleset - Local DNS Mapping (${name})`)
        .withDescription([
          ...SHARED_DESCRIPTION,
          '',
          'This is an internal rule that is only referenced by sukka_local_dns_mapping.sgmodule',
          'Do not use this file in your Rule section, all rules are included in non_ip/domestic.conf already.'
        ]);

      domains.forEach((domain) => {
        switch (domain[0]) {
          case '$':
            output.addDomain(domain.slice(1));
            break;
          case '+':
            output.addDomainSuffix(domain.slice(1));
            break;
          default:
            output.addDomainSuffix(domain);
            break;
        }
      });

      return output.write();
    }),

    compareAndWriteFile(
      span,
      [
        '#!name=[Sukka] Local DNS Mapping',
        `#!desc=Last Updated: ${new Date().toISOString()}`,
        '',
        '[Host]',
        ...Object.entries(
          // I use an object to deduplicate the domains
          // Otherwise I could just construct an array directly
          dataset.reduce<Record<string, string>>((acc, cur) => {
            const ruleset_name = cur[0].toLowerCase();
            const { domains, dns, hosts, ruleset } = cur[1];

            Object.entries(hosts).forEach(([dns, ips]) => {
              acc[dns] ||= ips.join(', ');
            });

            if (ruleset) {
              acc[`RULE-SET:https://ruleset.skk.moe/Modules/Rules/sukka_local_dns_mapping/${ruleset_name}.conf`] ||= `server:${dns}`;
            } else {
              domains.forEach((domain) => {
                switch (domain[0]) {
                  case '$':
                    acc[domain.slice(1)] ||= `server:${dns}`;
                    break;
                  case '+':
                    acc[`*.${domain.slice(1)}`] ||= `server:${dns}`;
                    break;
                  default:
                    acc[domain] ||= `server:${dns}`;
                    acc[`*.${domain}`] ||= `server:${dns}`;
                    break;
                }
              });
            }

            return acc;
          }, {})
        ).map(([dns, ips]) => `${dns} = ${ips}`)
      ],
      path.resolve(OUTPUT_MODULES_DIR, 'sukka_local_dns_mapping.sgmodule')
    ),
    compareAndWriteFile(
      span,
      yaml.stringify(
        dataset.reduce<{
          dns: { 'nameserver-policy': Record<string, string | string[]> },
          hosts: Record<string, string>
        }>((acc, cur) => {
          const { domains, dns, ...rest } = cur[1];
          domains.forEach((domain) => {
            switch (domain[0]) {
              case '$':
                domain = domain.slice(1);
                break;
              case '+':
                domain = `*.${domain.slice(1)}`;
                break;
              default:
                domain = `+.${domain}`;
                break;
            }

            acc.dns['nameserver-policy'][domain] = dns === 'system'
              ? ['system://', 'system', 'dhcp://system']
              : dns;
          });

          if ('hosts' in rest) {
            Object.assign(acc.hosts, rest.hosts);
          }

          return acc;
        }, {
          dns: { 'nameserver-policy': {} },
          hosts: {}
        }),
        { version: '1.1' }
      ).split('\n'),
      path.join(OUTPUT_INTERNAL_DIR, 'clash_nameserver_policy.yaml')
    ),
    compareAndWriteFile(
      span,
      [
        '# Local DNS Mapping for AdGuard Home',
        'tls://1.12.12.12',
        'tls://120.53.53.53',
        'https://1.12.12.12/dns-query',
        'https://120.53.53.53/dns-query',
        '[//]udp://10.10.1.1:53',
        ...(([DOMESTICS, DIRECTS, LAN, HOSTS] as const).flatMap(Object.values) as DNSMapping[]).flatMap(({ domains, dns: _dns }) => domains.flatMap((domain) => {
          let dns;
          if (_dns in AdGuardHomeDNSMapping) {
            dns = AdGuardHomeDNSMapping[_dns as keyof typeof AdGuardHomeDNSMapping].join(' ');
          } else {
            console.warn(`Unknown DNS "${_dns}" not in AdGuardHomeDNSMapping`);
            dns = _dns;
          }

          // if (
          //   // AdGuard Home has built-in AS112 / private PTR handling
          //   domain.endsWith('.arpa')
          //   // Ignore simple hostname
          //   || !domain.includes('.')
          // ) {
          //   return [];
          // }
          if (domain[0] === '$') {
            return [
              `[/${domain.slice(1)}/]${dns}`
            ];
          }
          if (domain[0] === '+') {
            return [
              `[/${domain.slice(1)}/]${dns}`
            ];
          }
          return [
            `[/${domain}/]${dns}`
          ];
        }))
      ],
      path.resolve(OUTPUT_INTERNAL_DIR, 'dns_mapping_adguardhome.conf')
    )
  ]);
});
