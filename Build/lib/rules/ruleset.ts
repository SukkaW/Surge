import { merge } from 'fast-cidr-tools';
import type { Span } from '../../trace';
import { createAhoCorasick as createKeywordFilter } from 'foxts/ahocorasick';
import { appendArrayInPlace } from '../append-array-in-place';
import { appendSetElementsToArray } from 'foxts/append-set-elements-to-array';
import type { SingboxSourceFormat } from '../singbox';
import { RuleOutput } from './base';
import picocolors from 'picocolors';
import { normalizeDomain } from '../normalize-domain';
import { isProbablyIpv4, isProbablyIpv6 } from 'foxts/is-probably-ip';

type Preprocessed = [domain: string[], domainSuffix: string[], sortedDomainRules: string[]];

export class RulesetOutput extends RuleOutput<Preprocessed> {
  constructor(span: Span, id: string, protected type: 'non_ip' | 'ip') {
    super(span, id);
  }

  protected preprocess() {
    const kwfilter = createKeywordFilter(this.domainKeywords);

    const domains: string[] = [];
    const domainSuffixes: string[] = [];
    const sortedDomainRules: string[] = [];

    this.domainTrie.dump((domain) => {
      if (kwfilter(domain)) {
        return;
      }
      if (domain[0] === '.') {
        domainSuffixes.push(domain.slice(1));
        sortedDomainRules.push(`DOMAIN-SUFFIX,${domain.slice(1)}`);
      } else {
        domains.push(domain);
        sortedDomainRules.push(`DOMAIN,${domain}`);
      }
    }, true);

    return [domains, domainSuffixes, sortedDomainRules] satisfies Preprocessed;
  }

  surge(): string[] {
    const results: string[] = ['DOMAIN,this_ruleset_is_made_by_sukkaw.ruleset.skk.moe'];
    appendArrayInPlace(results, this.$preprocessed[2]);

    appendSetElementsToArray(results, this.domainKeywords, i => `DOMAIN-KEYWORD,${i}`);
    appendSetElementsToArray(results, this.domainWildcard, i => `DOMAIN-WILDCARD,${i}`);

    appendSetElementsToArray(results, this.userAgent, i => `USER-AGENT,${i}`);

    appendSetElementsToArray(results, this.processName, i => `PROCESS-NAME,${i}`);
    appendSetElementsToArray(results, this.processPath, i => `PROCESS-NAME,${i}`);

    appendSetElementsToArray(results, this.sourceIpOrCidr, i => `SRC-IP,${i}`);
    appendSetElementsToArray(results, this.sourcePort, i => `SRC-PORT,${i}`);
    appendSetElementsToArray(results, this.destPort, i => `DEST-PORT,${i}`);

    appendArrayInPlace(results, this.otherRules);

    appendSetElementsToArray(results, this.urlRegex, i => `URL-REGEX,${i}`);

    appendArrayInPlace(
      results,
      merge(Array.from(this.ipcidrNoResolve)).map(i => `IP-CIDR,${i},no-resolve`, true)
    );
    appendSetElementsToArray(results, this.ipcidr6NoResolve, i => `IP-CIDR6,${i},no-resolve`);
    appendSetElementsToArray(results, this.ipasnNoResolve, i => `IP-ASN,${i},no-resolve`);
    appendSetElementsToArray(results, this.groipNoResolve, i => `GEOIP,${i},no-resolve`);

    appendArrayInPlace(
      results,
      merge(Array.from(this.ipcidr)).map(i => `IP-CIDR,${i}`, true)
    );
    appendSetElementsToArray(results, this.ipcidr6, i => `IP-CIDR6,${i}`);
    appendSetElementsToArray(results, this.ipasn, i => `IP-ASN,${i}`);
    appendSetElementsToArray(results, this.geoip, i => `GEOIP,${i}`);

    return results;
  }

  clash(): string[] {
    const results: string[] = ['DOMAIN,this_ruleset_is_made_by_sukkaw.ruleset.skk.moe'];

    appendArrayInPlace(results, this.$preprocessed[2]);

    appendSetElementsToArray(results, this.domainKeywords, i => `DOMAIN-KEYWORD,${i}`);
    appendSetElementsToArray(results, this.domainWildcard, i => `DOMAIN-REGEX,${RuleOutput.domainWildCardToRegex(i)}`);

    appendSetElementsToArray(results, this.processName, i => `PROCESS-NAME,${i}`);
    appendSetElementsToArray(results, this.processPath, i => `PROCESS-PATH,${i}`);

    appendSetElementsToArray(results, this.sourceIpOrCidr, value => {
      if (value.includes('/')) {
        return `SRC-IP-CIDR,${value}`;
      }
      if (isProbablyIpv4(value)) {
        return `SRC-IP-CIDR,${value}/32`;
      }
      if (isProbablyIpv6(value)) {
        return `SRC-IP-CIDR6,${value}/128`;
      }
      return '';
    });
    appendSetElementsToArray(results, this.sourcePort, i => `SRC-PORT,${i}`);
    appendSetElementsToArray(results, this.destPort, i => `DST-PORT,${i}`);

    // appendArrayInPlace(results, this.otherRules);

    appendArrayInPlace(
      results,
      merge(Array.from(this.ipcidrNoResolve)).map(i => `IP-CIDR,${i},no-resolve`, true)
    );
    appendSetElementsToArray(results, this.ipcidr6NoResolve, i => `IP-CIDR6,${i},no-resolve`);
    appendSetElementsToArray(results, this.ipasnNoResolve, i => `IP-ASN,${i},no-resolve`);
    appendSetElementsToArray(results, this.groipNoResolve, i => `GEOIP,${i},no-resolve`);

    appendArrayInPlace(
      results,
      merge(Array.from(this.ipcidr)).map(i => `IP-CIDR,${i}`, true)
    );
    appendSetElementsToArray(results, this.ipcidr6, i => `IP-CIDR6,${i}`);
    appendSetElementsToArray(results, this.ipasn, i => `IP-ASN,${i}`);
    appendSetElementsToArray(results, this.geoip, i => `GEOIP,${i}`);

    return results;
  }

  singbox(): string[] {
    const ip_cidr: string[] = [];
    appendArrayInPlace(
      ip_cidr,
      merge(
        appendArrayInPlace(Array.from(this.ipcidrNoResolve), Array.from(this.ipcidr)),
        true
      )
    );
    appendSetElementsToArray(ip_cidr, this.ipcidr6NoResolve);
    appendSetElementsToArray(ip_cidr, this.ipcidr6);

    const singbox: SingboxSourceFormat = {
      version: 2,
      rules: [{
        domain: appendArrayInPlace(['this_ruleset_is_made_by_sukkaw.ruleset.skk.moe'], this.$preprocessed[0]),
        domain_suffix: this.$preprocessed[1],
        domain_keyword: Array.from(this.domainKeywords),
        domain_regex: Array.from(this.domainWildcard).map(RuleOutput.domainWildCardToRegex),
        ip_cidr,
        source_ip_cidr: [...this.sourceIpOrCidr].reduce<string[]>((acc, cur) => {
          if (cur.includes('/')) {
            acc.push(cur);
          } else if (isProbablyIpv4(cur)) {
            acc.push(cur + '/32');
          } else if (isProbablyIpv6(cur)) {
            acc.push(cur + '/128');
          }

          return acc;
        }, []),
        source_port: [...this.sourcePort].reduce<number[]>((acc, cur) => {
          const tmp = Number(cur);
          if (!Number.isNaN(tmp)) {
            acc.push(tmp);
          }
          return acc;
        }, []),
        port: [...this.destPort].reduce<number[]>((acc, cur) => {
          const tmp = Number(cur);
          if (!Number.isNaN(tmp)) {
            acc.push(tmp);
          }
          return acc;
        }, []),
        process_name: Array.from(this.processName),
        process_path: Array.from(this.processPath)
      }]
    };

    return RuleOutput.jsonToLines(singbox);
  }

  mitmSgmodule(): string[] | null {
    if (this.urlRegex.size === 0 || this.mitmSgmodulePath === null) {
      return null;
    }

    const urlRegexResults: Array<{ origin: string, processed: string[] }> = [];

    const parsedFailures: Array<[original: string, processed: string]> = [];
    const parsed: Array<[original: string, domain: string]> = [];

    for (let urlRegex of this.urlRegex) {
      if (
        urlRegex.startsWith('http://')
        || urlRegex.startsWith('^http://')
      ) {
        continue;
      }
      if (urlRegex.startsWith('^https?://')) {
        urlRegex = urlRegex.slice(10);
      }
      if (urlRegex.startsWith('^https://')) {
        urlRegex = urlRegex.slice(9);
      }

      const potentialHostname = urlRegex.split('/')[0]
        // pre process regex
        .replaceAll(String.raw`\.`, '.')
        .replaceAll('.+', '*')
        .replaceAll(/([a-z])\?/g, '($1|)')
        // convert regex to surge hostlist syntax
        .replaceAll('([a-z])', '?')
        .replaceAll(String.raw`\d`, '?')
        .replaceAll(/\*+/g, '*');

      let processed: string[] = [potentialHostname];

      const matches = [...potentialHostname.matchAll(/\((?:([^()|]+)\|)+([^()|]*)\)/g)];

      if (matches.length > 0) {
        const replaceVariant = (combinations: string[], fullMatch: string, options: string[]): string[] => {
          const newCombinations: string[] = [];

          combinations.forEach(combination => {
            options.forEach(option => {
              newCombinations.push(combination.replace(fullMatch, option));
            });
          });

          return newCombinations;
        };

        for (let i = 0; i < matches.length; i++) {
          const match = matches[i];
          const [_, ...options] = match;

          processed = replaceVariant(processed, _, options);
        }
      }

      urlRegexResults.push({
        origin: potentialHostname,
        processed
      });
    }

    for (const i of urlRegexResults) {
      for (const processed of i.processed) {
        if (normalizeDomain(
          processed
            .replaceAll('*', 'a')
            .replaceAll('?', 'b')
        )) {
          parsed.push([i.origin, processed]);
        } else if (!isProbablyIpv4(processed)) {
          parsedFailures.push([i.origin, processed]);
        }
      }
    }

    if (parsedFailures.length > 0) {
      console.error(picocolors.bold('Parsed Failed'));
      console.table(parsedFailures);
    }

    const hostnames = Array.from(new Set(parsed.map(i => i[1])));

    return [
      '#!name=[Sukka] Surge Reject MITM',
      `#!desc=为 URL Regex 规则组启用 MITM (size: ${hostnames.length})`,
      '',
      '[MITM]',
      'hostname = %APPEND% ' + hostnames.join(', ')
    ];
  }
}
