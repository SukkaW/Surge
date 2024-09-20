import path from 'node:path';

import type { Span } from '../trace';
import { surgeDomainsetToClashDomainset, surgeRulesetToClashClassicalTextRuleset } from './clash';
import { compareAndWriteFile, defaultSortTypeOrder, sortTypeOrder, withBannerArray } from './create-file';
import { ipCidrListToSingbox, surgeDomainsetToSingbox, surgeRulesetToSingbox } from './singbox';
import { buildParseDomainMap, sortDomains } from './stable-sort-domain';
import { createTrie } from './trie';
import { invariant } from 'foxact/invariant';
import { OUTPUT_CLASH_DIR, OUTPUT_SINGBOX_DIR, OUTPUT_SURGE_DIR } from '../constants/dir';
import stringify from 'json-stringify-pretty-compact';
import { appendArrayInPlace } from './append-array-in-place';
import { nullthrow } from 'foxact/nullthrow';
import createKeywordFilter from './aho-corasick';

abstract class RuleOutput {
  protected domainTrie = createTrie<unknown>(null, true);
  protected domainKeywords = new Set<string>();
  protected domainWildcard = new Set<string>();
  protected ipcidr = new Set<string>();
  protected ipcidrNoResolve = new Set<string>();
  protected ipcidr6 = new Set<string>();
  protected ipcidr6NoResolve = new Set<string>();
  protected otherRules: Array<[raw: string, orderWeight: number]> = [];
  protected abstract type: 'domainset' | 'non_ip' | 'ip';

  protected pendingPromise = Promise.resolve();

  static jsonToLines(this: void, json: unknown): string[] {
    return stringify(json).split('\n');
  }

  constructor(
    protected readonly span: Span,
    protected readonly id: string
  ) {}

  protected title: string | null = null;
  withTitle(title: string) {
    this.title = title;
    return this;
  }

  protected description: string[] | readonly string[] | null = null;
  withDescription(description: string[] | readonly string[]) {
    this.description = description;
    return this;
  }

  protected date = new Date();
  withDate(date: Date) {
    this.date = date;
    return this;
  }

  protected apexDomainMap: Map<string, string> | null = null;
  protected subDomainMap: Map<string, string> | null = null;
  withDomainMap(apexDomainMap: Map<string, string>, subDomainMap: Map<string, string>) {
    this.apexDomainMap = apexDomainMap;
    this.subDomainMap = subDomainMap;
    return this;
  }

  addDomain(domain: string) {
    this.domainTrie.add(domain);
    return this;
  }

  addDomainSuffix(domain: string) {
    this.domainTrie.add(domain[0] === '.' ? domain : '.' + domain);
    return this;
  }

  bulkAddDomainSuffix(domains: string[]) {
    for (let i = 0, len = domains.length; i < len; i++) {
      this.addDomainSuffix(domains[i]);
    }
    return this;
  }

  addDomainKeyword(keyword: string) {
    this.domainKeywords.add(keyword);
    return this;
  }

  addDomainWildcard(wildcard: string) {
    this.domainWildcard.add(wildcard);
    return this;
  }

  private async addFromDomainsetPromise(source: AsyncIterable<string> | Iterable<string> | string[]) {
    for await (const line of source) {
      if (line[0] === '.') {
        this.addDomainSuffix(line);
      } else {
        this.addDomain(line);
      }
    }
  }

  addFromDomainset(source: AsyncIterable<string> | Iterable<string> | string[]) {
    this.pendingPromise = this.pendingPromise.then(() => this.addFromDomainsetPromise(source));
    return this;
  }

  private async addFromRulesetPromise(source: AsyncIterable<string> | Iterable<string>) {
    for await (const line of source) {
      const splitted = line.split(',');
      const type = splitted[0];
      const value = splitted[1];
      const arg = splitted[2];

      switch (type) {
        case 'DOMAIN':
          this.addDomain(value);
          break;
        case 'DOMAIN-SUFFIX':
          this.addDomainSuffix(value);
          break;
        case 'DOMAIN-KEYWORD':
          this.addDomainKeyword(value);
          break;
        case 'DOMAIN-WILDCARD':
          this.addDomainWildcard(value);
          break;
        case 'IP-CIDR':
          (arg === 'no-resolve' ? this.ipcidrNoResolve : this.ipcidr).add(value);
          break;
        case 'IP-CIDR6':
          (arg === 'no-resolve' ? this.ipcidr6NoResolve : this.ipcidr6).add(value);
          break;
        default:
          this.otherRules.push([line, type in sortTypeOrder ? sortTypeOrder[type] : sortTypeOrder[defaultSortTypeOrder]]);
          break;
      }
    }
  }

  addFromRuleset(source: AsyncIterable<string> | Iterable<string>) {
    this.pendingPromise = this.pendingPromise.then(() => this.addFromRulesetPromise(source));
    return this;
  }

  bulkAddCIDR4(cidr: string[]) {
    for (let i = 0, len = cidr.length; i < len; i++) {
      this.ipcidr.add(cidr[i]);
    }
    return this;
  }

  bulkAddCIDR4NoResolve(cidr: string[]) {
    for (let i = 0, len = cidr.length; i < len; i++) {
      this.ipcidrNoResolve.add(cidr[i]);
    }
    return this;
  }

  bulkAddCIDR6(cidr: string[]) {
    for (let i = 0, len = cidr.length; i < len; i++) {
      this.ipcidr6.add(cidr[i]);
    }
    return this;
  }

  bulkAddCIDR6NoResolve(cidr: string[]) {
    for (let i = 0, len = cidr.length; i < len; i++) {
      this.ipcidr6NoResolve.add(cidr[i]);
    }
    return this;
  }

  abstract write(): Promise<void>;
}

export class DomainsetOutput extends RuleOutput {
  protected type = 'domainset' as const;

  private $dumped: string[] | null = null;

  get dumped() {
    if (!this.$dumped) {
      const kwfilter = createKeywordFilter(this.domainKeywords);

      const results: string[] = [];

      const dumped = this.domainTrie.dump();

      for (let i = 0, len = dumped.length; i < len; i++) {
        const domain = dumped[i];
        if (!kwfilter(domain)) {
          results.push(domain);
        }
      }

      this.$dumped = results;
    }
    return this.$dumped;
  }

  calcDomainMap() {
    if (!this.apexDomainMap || !this.subDomainMap) {
      const { domainMap, subdomainMap } = buildParseDomainMap(this.dumped);
      this.apexDomainMap = domainMap;
      this.subDomainMap = subdomainMap;
    }
  }

  async write() {
    await this.pendingPromise;

    invariant(this.title, 'Missing title');
    invariant(this.description, 'Missing description');

    const sorted = sortDomains(this.dumped, this.apexDomainMap, this.subDomainMap);
    sorted.push('this_ruleset_is_made_by_sukkaw.ruleset.skk.moe');

    const surge = sorted;
    const clash = surgeDomainsetToClashDomainset(sorted);
    // TODO: Implement singbox directly using data
    const singbox = RuleOutput.jsonToLines(surgeDomainsetToSingbox(sorted));

    await Promise.all([
      compareAndWriteFile(
        this.span,
        withBannerArray(
          this.title,
          this.description,
          this.date,
          surge
        ),
        path.join(OUTPUT_SURGE_DIR, this.type, this.id + '.conf')
      ),
      compareAndWriteFile(
        this.span,
        withBannerArray(
          this.title,
          this.description,
          this.date,
          clash
        ),
        path.join(OUTPUT_CLASH_DIR, this.type, this.id + '.txt')
      ),
      compareAndWriteFile(
        this.span,
        singbox,
        path.join(OUTPUT_SINGBOX_DIR, this.type, this.id + '.json')
      )
    ]);
  }

  getStatMap() {
    invariant(this.dumped, 'Non dumped yet');
    invariant(this.apexDomainMap, 'Missing apex domain map');

    return Array.from(
      (
        nullthrow(this.dumped, 'Non dumped yet').reduce<Map<string, number>>((acc, cur) => {
          const suffix = this.apexDomainMap!.get(cur);
          if (suffix) {
            acc.set(suffix, (acc.get(suffix) ?? 0) + 1);
          }
          return acc;
        }, new Map())
      ).entries()
    )
      .filter(a => a[1] > 9)
      .sort(
        (a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0])
      )
      .map(([domain, count]) => `${domain}${' '.repeat(100 - domain.length)}${count}`);
  }
}

export class IPListOutput extends RuleOutput {
  protected type = 'ip' as const;

  constructor(span: Span, id: string, private readonly clashUseRule = true) {
    super(span, id);
  }

  async write() {
    await this.pendingPromise;

    invariant(this.title, 'Missing title');
    invariant(this.description, 'Missing description');

    const sorted4 = Array.from(this.ipcidr);
    const sorted6 = Array.from(this.ipcidr6);
    const merged = appendArrayInPlace(appendArrayInPlace([], sorted4), sorted6);

    const surge = sorted4.map(i => `IP-CIDR,${i}`);
    appendArrayInPlace(surge, sorted6.map(i => `IP-CIDR6,${i}`));
    surge.push('DOMAIN,this_ruleset_is_made_by_sukkaw.ruleset.skk.moe');

    const clash = this.clashUseRule ? surge : merged;
    // TODO: Implement singbox directly using data
    const singbox = RuleOutput.jsonToLines(ipCidrListToSingbox(merged));

    await Promise.all([
      compareAndWriteFile(
        this.span,
        withBannerArray(
          this.title,
          this.description,
          this.date,
          surge
        ),
        path.join(OUTPUT_SURGE_DIR, this.type, this.id + '.conf')
      ),
      compareAndWriteFile(
        this.span,
        withBannerArray(
          this.title,
          this.description,
          this.date,
          clash
        ),
        path.join(OUTPUT_CLASH_DIR, this.type, this.id + '.txt')
      ),
      compareAndWriteFile(
        this.span,
        singbox,
        path.join(OUTPUT_SINGBOX_DIR, this.type, this.id + '.json')
      )
    ]);
  }
}

export class RulesetOutput extends RuleOutput {
  constructor(span: Span, id: string, protected type: 'non_ip' | 'ip') {
    super(span, id);
  }

  async write() {
    await this.pendingPromise;

    invariant(this.title, 'Missing title');
    invariant(this.description, 'Missing description');

    const results: string[] = [
      'DOMAIN,this_ruleset_is_made_by_sukkaw.ruleset.skk.moe'
    ];

    const kwfilter = createKeywordFilter(this.domainKeywords);

    const sortedDomains = sortDomains(this.domainTrie.dump(), this.apexDomainMap, this.subDomainMap);
    for (let i = 0, len = sortedDomains.length; i < len; i++) {
      const domain = sortedDomains[i];
      if (kwfilter(domain)) {
        continue;
      }
      if (domain[0] === '.') {
        results.push(`DOMAIN-SUFFIX,${domain.slice(1)}`);
      } else {
        results.push(`DOMAIN,${domain}`);
      }
    }

    for (const keyword of this.domainKeywords) {
      results.push(`DOMAIN-KEYWORD,${keyword}`);
    }
    for (const wildcard of this.domainWildcard) {
      results.push(`DOMAIN-WILDCARD,${wildcard}`);
    }

    const sortedRules = this.otherRules.sort((a, b) => a[1] - b[1]);
    for (let i = 0, len = sortedRules.length; i < len; i++) {
      results.push(sortedRules[i][0]);
    }

    this.ipcidr.forEach(cidr => results.push(`IP-CIDR,${cidr}`));
    this.ipcidrNoResolve.forEach(cidr => results.push(`IP-CIDR,${cidr},no-resolve`));
    this.ipcidr6.forEach(cidr => results.push(`IP-CIDR6,${cidr}`));
    this.ipcidr6NoResolve.forEach(cidr => results.push(`IP-CIDR6,${cidr},no-resolve`));

    const surge = results;
    const clash = surgeRulesetToClashClassicalTextRuleset(results);
    // TODO: Implement singbox directly using data
    const singbox = RuleOutput.jsonToLines(surgeRulesetToSingbox(results));

    await Promise.all([
      compareAndWriteFile(
        this.span,
        withBannerArray(
          this.title,
          this.description,
          this.date,
          surge
        ),
        path.join(OUTPUT_SURGE_DIR, this.type, this.id + '.conf')
      ),
      compareAndWriteFile(
        this.span,
        withBannerArray(
          this.title,
          this.description,
          this.date,
          clash
        ),
        path.join(OUTPUT_CLASH_DIR, this.type, this.id + '.txt')
      ),
      compareAndWriteFile(
        this.span,
        singbox,
        path.join(OUTPUT_SINGBOX_DIR, this.type, this.id + '.json')
      )
    ]);
  }
}
