import { invariant } from 'foxts/guard';
import { createAhoCorasick as createKeywordFilter } from 'foxts/ahocorasick';
import { RuleOutput } from './base';
import type { SingboxSourceFormat } from '../singbox';

import * as tldts from 'tldts-experimental';
import { looseTldtsOpt } from '../../constants/loose-tldts-opt';
import { fastStringCompare } from '../misc';
import { escapeStringRegexp } from 'foxts/escape-string-regexp';

export class DomainsetOutput extends RuleOutput<string[]> {
  protected type = 'domainset' as const;

  private $surge: string[] = ['this_ruleset_is_made_by_sukkaw.ruleset.skk.moe'];
  private $clash: string[] = ['this_ruleset_is_made_by_sukkaw.ruleset.skk.moe'];
  private $singbox_domains: string[] = ['this_ruleset_is_made_by_sukkaw.ruleset.skk.moe'];
  private $singbox_domains_suffixes: string[] = ['this_ruleset_is_made_by_sukkaw.ruleset.skk.moe'];
  private $adguardhome: string[] = [];
  preprocess() {
    const kwfilter = createKeywordFilter(this.domainKeywords);

    this.domainTrie.dumpWithoutDot((domain, subdomain) => {
      if (kwfilter(domain)) {
        return;
      }

      this.$surge.push(subdomain ? '.' + domain : domain);
      this.$clash.push(subdomain ? `+.${domain}` : domain);
      (subdomain ? this.$singbox_domains_suffixes : this.$singbox_domains).push(domain);

      if (subdomain) {
        this.$adguardhome.push(`||${domain}^`);
      } else {
        this.$adguardhome.push(`|${domain}^`);
      }
    }, true);

    return this.$surge;
  }

  surge(): string[] {
    this.runPreprocess();
    return this.$surge;
  }

  clash(): string[] {
    this.runPreprocess();
    return this.$clash;
  }

  singbox(): string[] {
    this.runPreprocess();

    return RuleOutput.jsonToLines({
      version: 2,
      rules: [{
        domain: this.$singbox_domains,
        domain_suffix: this.$singbox_domains_suffixes
      }]
    } satisfies SingboxSourceFormat);
  }

  protected apexDomainMap: Map<string, string> | null = null;
  getStatMap() {
    this.runPreprocess();

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
    this.runPreprocess();

    // const whitelistArray = sortDomains(Array.from(whitelist));
    // for (let i = 0, len = whitelistArray.length; i < len; i++) {
    //   const domain = whitelistArray[i];
    //   if (domain[0] === '.') {
    //     results.push(`@@||${domain.slice(1)}^`);
    //   } else {
    //     results.push(`@@|${domain}^`);
    //   }
    // }

    for (const wildcard of this.domainWildcard) {
      const processed = wildcard.replaceAll('?', '*');
      if (processed.startsWith('*.')) {
        this.$adguardhome.push(`||${processed.slice(2)}^`);
      } else {
        this.$adguardhome.push(`|${processed}^`);
      }
    }

    for (const keyword of this.domainKeywords) {
      // Use regex to match keyword
      this.$adguardhome.push(`/${escapeStringRegexp(keyword)}/`);
    }

    for (const ipGroup of [this.ipcidr, this.ipcidrNoResolve]) {
      for (const ipcidr of ipGroup) {
        if (ipcidr.endsWith('/32')) {
          this.$adguardhome.push(`||${ipcidr.slice(0, -3)}`);
          /* else if (ipcidr.endsWith('.0/24')) {
            results.push(`||${ipcidr.slice(0, -6)}.*`);
          } */
        } else {
          this.$adguardhome.push(`||${ipcidr}^`);
        }
      }
    }
    for (const ipGroup of [this.ipcidr6, this.ipcidr6NoResolve]) {
      for (const ipcidr of ipGroup) {
        if (ipcidr.endsWith('/128')) {
          this.$adguardhome.push(`||${ipcidr.slice(0, -4)}`);
        } else {
          this.$adguardhome.push(`||${ipcidr}`);
        }
      }
    }

    return this.$adguardhome;
  }
}
