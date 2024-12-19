// @ts-check
import path from 'node:path';
import { DOMESTICS, DOH_BOOTSTRAP, AdGuardHomeDNSMapping } from '../Source/non_ip/domestic';
import { DIRECTS, LAN } from '../Source/non_ip/direct';
import type { DNSMapping } from '../Source/non_ip/direct';
import { readFileIntoProcessedArray } from './lib/fetch-text-by-line';
import { compareAndWriteFile } from './lib/create-file';
import { task } from './trace';
import { SHARED_DESCRIPTION } from './constants/description';
import { createMemoizedPromise } from './lib/memo-promise';
import * as yaml from 'yaml';
import { appendArrayInPlace } from './lib/append-array-in-place';
import { OUTPUT_INTERNAL_DIR, OUTPUT_MODULES_DIR, SOURCE_DIR } from './constants/dir';
import { RulesetOutput } from './lib/create-file';

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

  return [domestics, directs, lans] as const;
});

export const buildDomesticRuleset = task(require.main === module, __filename)(async (span) => {
  const [domestics, directs, lans] = await getDomesticAndDirectDomainsRulesetPromise();

  const dataset: DNSMapping[] = ([DOH_BOOTSTRAP, DOMESTICS, DIRECTS] as const).flatMap(Object.values);

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
        ...Object.entries(
          // I use an object to deduplicate the domains
          // Otherwise I could just construct an array directly
          dataset.reduce<Record<string, string>>((acc, cur) => {
            const { domains, dns, hosts } = cur;

            Object.entries(hosts).forEach(([dns, ips]) => {
              acc[dns] ||= ips.join(', ');
            });

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
          const { domains, dns, ...rest } = cur;
          domains.forEach((domain) => {
            let domainWildcard = domain;
            if (domain[0] === '$') {
              domainWildcard = domain.slice(1);
            } else if (domain[0] === '+') {
              domainWildcard = `*.${domain.slice(1)}`;
            } else {
              domainWildcard = `+.${domain}`;
            }

            acc.dns['nameserver-policy'][domainWildcard] = dns === 'system'
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
        ...(([DOMESTICS, DIRECTS, LAN] as const).flatMap(Object.values) as DNSMapping[]).flatMap(({ domains, dns: _dns }) => domains.flatMap((domain) => {
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
