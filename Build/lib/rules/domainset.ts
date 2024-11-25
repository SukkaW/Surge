import { invariant } from 'foxact/invariant';
import createKeywordFilter from '../aho-corasick';
import { RuleOutput } from './base';
import type { SingboxSourceFormat } from '../singbox';

import * as tldts from 'tldts-experimental';
import { looseTldtsOpt } from '../../constants/loose-tldts-opt';
import { fastStringCompare } from '../misc';
import escapeStringRegexp from 'escape-string-regexp-node';

type Preprocessed = string[];

export class DomainsetOutput extends RuleOutput<Preprocessed> {
  protected type = 'domainset' as const;

  preprocess() {
    const kwfilter = createKeywordFilter(this.domainKeywords);

    const results: string[] = [];

    this.domainTrie.dump((domain) => {
      if (kwfilter(domain)) {
        return;
      }
      results.push(domain);
    }, true);

    const sorted = results;
    sorted.push('this_ruleset_is_made_by_sukkaw.ruleset.skk.moe');

    return sorted;
  }

  surge(): string[] {
    return this.$preprocessed;
  }

  clash(): string[] {
    return this.$preprocessed.map(i => (i[0] === '.' ? `+${i}` : i));
  }

  singbox(): string[] {
    const domains: string[] = [];
    const domainSuffixes: string[] = [];

    for (let i = 0, len = this.$preprocessed.length; i < len; i++) {
      const domain = this.$preprocessed[i];
      if (domain[0] === '.') {
        domainSuffixes.push(domain.slice(1));
      } else {
        domains.push(domain);
      }
    }

    return RuleOutput.jsonToLines({
      version: 2,
      rules: [{
        domain: domains,
        domain_suffix: domainSuffixes
      }]
    } satisfies SingboxSourceFormat);
  }

  protected apexDomainMap: Map<string, string> | null = null;
  getStatMap() {
    invariant(this.$preprocessed, 'Non dumped yet');

    if (!this.apexDomainMap) {
      const domainMap = new Map<string, string>();

      for (let i = 0, len = this.$preprocessed.length; i < len; i++) {
        const cur = this.$preprocessed[i];
        if (!domainMap.has(cur)) {
          const domain = tldts.getDomain(cur, looseTldtsOpt);
          domainMap.set(cur, domain ?? cur);
        }
      }
      this.apexDomainMap = domainMap;
    }

    return Array.from(this.$preprocessed
      .reduce<Map<string, number>>(
        (acc, cur) => {
          const suffix = this.apexDomainMap!.get(cur);
          if (suffix) {
            acc.set(suffix, (acc.get(suffix) ?? 0) + 1);
          }
          return acc;
        },
        new Map()
      )
      .entries())
      .filter(a => a[1] > 9)
      .sort((a, b) => (b[1] - a[1]) || fastStringCompare(a[0], b[0]))
      .map(([domain, count]) => `${domain}${' '.repeat(100 - domain.length)}${count}`);
  }

  mitmSgmodule = undefined;

  adguardhome(): string[] {
    const results: string[] = [];

    // const whitelistArray = sortDomains(Array.from(whitelist));
    // for (let i = 0, len = whitelistArray.length; i < len; i++) {
    //   const domain = whitelistArray[i];
    //   if (domain[0] === '.') {
    //     results.push(`@@||${domain.slice(1)}^`);
    //   } else {
    //     results.push(`@@|${domain}^`);
    //   }
    // }

    for (let i = 0, len = this.$preprocessed.length; i < len; i++) {
      const domain = this.$preprocessed[i];
      if (domain[0] === '.') {
        results.push(`||${domain.slice(1)}^`);
      } else {
        results.push(`|${domain}^`);
      }
    }

    for (const wildcard of this.domainWildcard) {
      const processed = wildcard.replaceAll('?', '*');
      if (processed.startsWith('*.')) {
        results.push(`||${processed.slice(2)}^`);
      } else {
        results.push(`|${processed}^`);
      }
    }

    for (const keyword of this.domainKeywords) {
      // Use regex to match keyword
      results.push(`/${escapeStringRegexp(keyword)}/`);
    }

    for (const ipGroup of [this.ipcidr, this.ipcidrNoResolve]) {
      for (const ipcidr of ipGroup) {
        if (ipcidr.endsWith('/32')) {
          results.push(`||${ipcidr.slice(0, -3)}`);
          /* else if (ipcidr.endsWith('.0/24')) {
            results.push(`||${ipcidr.slice(0, -6)}.*`);
          } */
        } else {
          results.push(`||${ipcidr}^`);
        }
      }
    }
    for (const ipGroup of [this.ipcidr6, this.ipcidr6NoResolve]) {
      for (const ipcidr of ipGroup) {
        if (ipcidr.endsWith('/128')) {
          results.push(`||${ipcidr.slice(0, -4)}`);
        } else {
          results.push(`||${ipcidr}`);
        }
      }
    }

    return results;
  }
}
