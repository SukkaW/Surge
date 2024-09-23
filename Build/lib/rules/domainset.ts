import { invariant } from 'foxact/invariant';
import createKeywordFilter from '../aho-corasick';
import { buildParseDomainMap, sortDomains } from '../stable-sort-domain';
import { RuleOutput } from './base';
import type { SingboxSourceFormat } from '../singbox';
import { nullthrow } from 'foxact/nullthrow';

type Preprocessed = string[];

export class DomainsetOutput extends RuleOutput<Preprocessed> {
  protected type = 'domainset' as const;

  preprocess() {
    const kwfilter = createKeywordFilter(this.domainKeywords);

    const results: string[] = [];

    const dumped = this.domainTrie.dump();

    for (let i = 0, len = dumped.length; i < len; i++) {
      const domain = dumped[i];
      if (!kwfilter(domain)) {
        results.push(domain);
      }
    }

    const sorted = sortDomains(results, this.apexDomainMap, this.subDomainMap);
    sorted.push('this_ruleset_is_made_by_sukkaw.ruleset.skk.moe');

    return sorted;
  }

  calcDomainMap() {
    if (!this.apexDomainMap || !this.subDomainMap) {
      const { domainMap, subdomainMap } = buildParseDomainMap(this.$preprocessed);
      this.apexDomainMap = domainMap;
      this.subDomainMap = subdomainMap;
    }
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

  getStatMap() {
    invariant(this.$preprocessed, 'Non dumped yet');
    invariant(this.apexDomainMap, 'Missing apex domain map');

    return Array.from(
      nullthrow(this.$preprocessed, 'Non dumped yet')
        .reduce<Map<string, number>>((acc, cur) => {
          const suffix = this.apexDomainMap!.get(cur);
          if (suffix) {
            acc.set(suffix, (acc.get(suffix) ?? 0) + 1);
          }
          return acc;
        }, new Map())
        .entries()
    )
      .filter(a => a[1] > 9)
      .sort(
        (a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0])
      )
      .map(([domain, count]) => `${domain}${' '.repeat(100 - domain.length)}${count}`);
  }
}
