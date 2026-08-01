import type { Span } from '../../trace';
import { HostnameSmolTrie } from 'hntrie/smol';
import { not, nullthrow } from 'foxts/guard';
import { fastIpVersion } from 'foxts/fast-ip-version';
import { addArrayElementsToSet } from 'foxts/add-array-elements-to-set';
import type { MaybePromise } from '../misc';
import type { BaseWriteStrategy } from '../writing-strategy/base';
import { SurgeMitmSgmodule } from '../writing-strategy/surge';
import { appendArrayInPlace } from 'foxts/append-array-in-place';
import { isMainThread } from 'node:worker_threads';
import { resolveStrategyOutputPath, serializeStrategy, writeDataToStrategies } from './strategy-write-data';
import type { OutputWorkerPayload, StrategyWriteData } from './strategy-write-data';
import { getOutputWorkerFarm } from './output-worker-farm';

/**
 * Below this many dumped domain entries, formatting + hashing + writing inline is
 * cheaper than a worker round trip (and avoids tiny outputs queueing behind big
 * jobs in the farm). Today only the reject domainsets / adguardhome outputs cross
 * this threshold.
 */
const OUTPUT_WORKER_THRESHOLD = 20000;

/**
 * Holds the universal rule data (domain, ip, url-regex, etc. etc.)
 * This class is not about format, instead it will call the class that does
 */
export class FileOutput {
  protected strategies: BaseWriteStrategy[] = [];

  protected dataSource = new Set<string>();

  public domainTrie = new HostnameSmolTrie();
  public wildcardSet = new Set<string>();

  protected domainKeywords = new Set<string>();

  private readonly whitelistKeywords = new Set<string>();

  protected userAgent = new Set<string>();
  protected processName = new Set<string>();
  protected processPath = new Set<string>();
  protected urlRegex = new Set<string>();
  protected ipcidr = new Set<string>();
  protected ipcidrNoResolve = new Set<string>();
  protected ipasn = new Set<string>();
  protected ipasnNoResolve = new Set<string>();
  protected ipcidr6 = new Set<string>();
  protected ipcidr6NoResolve = new Set<string>();
  protected geoip = new Set<string>();
  protected groipNoResolve = new Set<string>();

  protected sourceIpOrCidr = new Set<string>();
  protected sourcePort = new Set<string>();
  protected destPort = new Set<string>();
  protected protocol = new Set<string>();

  protected otherRules: string[] = [];

  private pendingPromise: Promise<any> | null = null;

  whitelistDomain = (domain: string) => {
    this.domainTrie.whitelist(domain);
    return this;
  };

  whitelistKeyword = (keyword: string) => {
    this.whitelistKeywords.add(keyword);
    return this;
  };

  protected readonly span: Span;

  constructor($span: Span, protected readonly id: string) {
    this.span = $span.traceChild('RuleOutput#' + id);
  }

  protected title: string | null = null;
  withTitle(title: string) {
    this.title = title;
    return this;
  }

  public withStrategies(strategies: BaseWriteStrategy[]) {
    this.strategies = strategies;
    return this;
  }

  withExtraStrategies(strategy: BaseWriteStrategy) {
    this.strategies.push(strategy);
  }

  protected description: string[] | null = null;
  withDescription(description: string[] | readonly string[]) {
    this.description = description as string[];
    return this;
  }

  appendDescription(description: string | string[], ...rest: string[]) {
    this.description ??= [];
    if (typeof description === 'string') {
      this.description.push(description);
    } else {
      appendArrayInPlace(this.description, description);
    }

    if (rest.length) {
      appendArrayInPlace(this.description, rest);
    }

    return this;
  }

  protected date = new Date();
  withDate(date: Date) {
    this.date = date;
    return this;
  }

  addDomain(domain: string) {
    this.domainTrie.add(domain);
    return this;
  }

  bulkAddDomain(domains: Array<string | null>) {
    for (let i = 0, len = domains.length; i < len; i++) {
      const d = domains[i];
      if (d !== null) {
        this.domainTrie.add(d);
      }
    }
    return this;
  }

  addDomainSuffix(domain: string) {
    if (domain[0] === '.') {
      this.domainTrie.add(domain);
    } else {
      this.domainTrie.addSubdomain(domain);
    }
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

  bulkAddDomainKeyword(keywords: string[]) {
    for (let i = 0, len = keywords.length; i < len; i++) {
      this.domainKeywords.add(keywords[i]);
    }
    return this;
  }

  addDomainWildcard(wildcard: string) {
    this.wildcardSet.add(wildcard);
    return this;
  }

  bulkAddDomainWildcard(wildcards: string[]) {
    for (let i = 0, len = wildcards.length; i < len; i++) {
      this.wildcardSet.add(wildcards[i]);
    }
    return this;
  }

  addIPASN(asn: string) {
    this.ipasn.add(asn);
    return this;
  }

  bulkAddIPASN(asns: string[]) {
    for (let i = 0, len = asns.length; i < len; i++) {
      this.ipasn.add(asns[i]);
    }
    return this;
  }

  private async addFromDomainsetPromise(source: MaybePromise<AsyncIterable<string> | Iterable<string> | string[]>) {
    for await (let line of await source) {
      const otherPoundSign = line.lastIndexOf('#');

      if (otherPoundSign > 0) {
        line = line.slice(0, otherPoundSign).trimEnd();
      }

      if (line[0] === '.') {
        this.addDomainSuffix(line);
      } else {
        this.domainTrie.add(line);
      }
    }
  }

  addFromDomainset(source: MaybePromise<AsyncIterable<string> | Iterable<string> | string[]>) {
    if (this.pendingPromise) {
      this.pendingPromise = this.pendingPromise.then(() => this.addFromDomainsetPromise(source));
      return this;
    }
    this.pendingPromise = this.addFromDomainsetPromise(source);
    return this;
  }

  private async addFromRulesetPromise(source: MaybePromise<AsyncIterable<string> | Iterable<string> | string[]>) {
    for await (let line of await source) {
      const otherPoundSign = line.lastIndexOf('#');

      if (otherPoundSign > 0) {
        line = line.slice(0, otherPoundSign).trimEnd();
      }

      const splitted = line.split(',');
      const type = splitted[0].toUpperCase();
      const value = splitted[1];
      const arg = splitted[2];

      switch (type) {
        case 'DOMAIN':
          this.domainTrie.add(value);
          break;
        case 'DOMAIN-SUFFIX':
          this.domainTrie.addSubdomain(value);
          break;
        case 'DOMAIN-KEYWORD':
          this.addDomainKeyword(value);
          break;
        case 'DOMAIN-WILDCARD':
          this.wildcardSet.add(value);
          break;
        case 'USER-AGENT':
          this.userAgent.add(value);
          break;
        case 'PROCESS-NAME':
          if (value.includes('/') || value.includes('\\')) {
            this.processPath.add(value);
          } else {
            this.processName.add(value);
          }
          break;
        case 'URL-REGEX': {
          const [, ...rest] = splitted;
          this.urlRegex.add(rest.join(','));
          break;
        }
        case 'IP-CIDR':
          (arg === 'no-resolve' ? this.ipcidrNoResolve : this.ipcidr).add(value);
          break;
        case 'IP-CIDR6':
          (arg === 'no-resolve' ? this.ipcidr6NoResolve : this.ipcidr6).add(value);
          break;
        case 'IP-ASN':
          (arg === 'no-resolve' ? this.ipasnNoResolve : this.ipasn).add(value);
          break;
        case 'GEOIP':
          (arg === 'no-resolve' ? this.groipNoResolve : this.geoip).add(value);
          break;
        case 'SRC-IP':
          this.sourceIpOrCidr.add(value);
          break;
        case 'SRC-PORT':
          this.sourcePort.add(value);
          break;
        case 'DEST-PORT':
          this.destPort.add(value);
          break;
        case 'PROTOCOL':
          this.protocol.add(value.toUpperCase());
          break;
        default:
          this.otherRules.push(line);
          break;
      }
    }
  }

  addFromRuleset(source: MaybePromise<AsyncIterable<string> | Iterable<string>>) {
    if (this.pendingPromise) {
      this.pendingPromise = this.pendingPromise.then(() => this.addFromRulesetPromise(source));
      return this;
    }
    this.pendingPromise = this.addFromRulesetPromise(source);
    return this;
  }

  static readonly ipToCidr = (ip: string, version: 4 | 6) => {
    if (ip.includes('/')) return ip;
    if (version === 4) {
      return ip + '/32';
    }
    return ip + '/128';
  };

  addAnyCIDR(cidr: string, noResolve = false) {
    const version = fastIpVersion(cidr);
    if (version === 0) return this;

    let list: Set<string>;
    if (version === 4) {
      list = noResolve ? this.ipcidrNoResolve : this.ipcidr;
    } else /* if (version === 6) */ {
      list = noResolve ? this.ipcidr6NoResolve : this.ipcidr6;
    }

    list.add(FileOutput.ipToCidr(cidr, version));
    return this;
  }

  bulkAddAnyCIDR(cidrs: string[], noResolve = false) {
    const list4 = noResolve ? this.ipcidrNoResolve : this.ipcidr;
    const list6 = noResolve ? this.ipcidr6NoResolve : this.ipcidr6;

    for (let i = 0, len = cidrs.length; i < len; i++) {
      let cidr = cidrs[i];
      const version = fastIpVersion(cidr);
      if (version === 0) {
        continue; // skip invalid IPs
      }
      cidr = FileOutput.ipToCidr(cidr, version);

      if (version === 4) {
        list4.add(cidr);
      } else /* if (version === 6) */ {
        list6.add(cidr);
      }
    }
    return this;
  }

  bulkAddCIDR4(cidrs: string[]) {
    for (let i = 0, len = cidrs.length; i < len; i++) {
      this.ipcidr.add(FileOutput.ipToCidr(cidrs[i], 4));
    }
    return this;
  }

  bulkAddCIDR4NoResolve(cidrs: string[]) {
    for (let i = 0, len = cidrs.length; i < len; i++) {
      this.ipcidrNoResolve.add(FileOutput.ipToCidr(cidrs[i], 4));
    }
    return this;
  }

  bulkAddCIDR6(cidrs: string[]) {
    for (let i = 0, len = cidrs.length; i < len; i++) {
      this.ipcidr6.add(FileOutput.ipToCidr(cidrs[i], 6));
    }
    return this;
  }

  bulkAddCIDR6NoResolve(cidrs: string[]) {
    for (let i = 0, len = cidrs.length; i < len; i++) {
      this.ipcidr6NoResolve.add(FileOutput.ipToCidr(cidrs[i], 6));
    }
    return this;
  }

  /**
   * Add data source information. This will be rendered inside description
   */
  appendDataSource(source: string | string[]) {
    if (typeof source === 'string') {
      this.dataSource.add(source);
    } else {
      addArrayElementsToSet(this.dataSource, source);
    }

    return this;
  }

  async done() {
    await this.pendingPromise;
    this.pendingPromise = null;
    return this;
  }

  // private guardPendingPromise() {
  //   // reverse invariant
  //   if (this.pendingPromise !== null) {
  //     console.trace('Pending promise:', this.pendingPromise);
  //     throw new Error('You should call done() before calling this method');
  //   }
  // }

  // async writeClash(outputDir?: null | string) {
  //   await this.done();

  //   invariant(this.title, 'Missing title');
  //   invariant(this.description, 'Missing description');

  //   return compareAndWriteFile(
  //     this.span,
  //     withBannerArray(
  //       this.title,
  //       this.description,
  //       this.date,
  //       this.clash()
  //     ),
  //     path.join(outputDir ?? OUTPUT_CLASH_DIR, this.type, this.id + '.txt')
  //   );
  // }
  private strategiesWritten = false;

  /** Collect the trie content, '.'-prefix encoded, WITHOUT punycoding (that happens in the fanout) */
  private dumpDomains(): string[] {
    const domains: string[] = [];
    this.domainTrie.dump((domain, includeSubdomain) => {
      domains.push(includeSubdomain ? '.' + domain : domain);
    });
    return domains;
  }

  private buildStrategyWriteData(domains: string[]): StrategyWriteData {
    return {
      domains,
      domainKeywords: Array.from(this.domainKeywords),
      whitelistKeywords: Array.from(this.whitelistKeywords),
      wildcards: Array.from(this.wildcardSet),
      userAgents: Array.from(this.userAgent),
      processNames: Array.from(this.processName),
      processPaths: Array.from(this.processPath),
      urlRegexes: Array.from(this.urlRegex),
      ipcidr: Array.from(this.ipcidr),
      ipcidrNoResolve: Array.from(this.ipcidrNoResolve),
      ipcidr6: Array.from(this.ipcidr6),
      ipcidr6NoResolve: Array.from(this.ipcidr6NoResolve),
      ipasn: Array.from(this.ipasn),
      ipasnNoResolve: Array.from(this.ipasnNoResolve),
      geoip: Array.from(this.geoip),
      geoipNoResolve: Array.from(this.groipNoResolve),
      sourceIpOrCidr: Array.from(this.sourceIpOrCidr),
      sourcePort: Array.from(this.sourcePort),
      destPort: Array.from(this.destPort),
      protocol: Array.from(this.protocol),
      otherRules: this.otherRules
    };
  }

  private guardBeforeWritingToStrategies() {
    if (this.pendingPromise) {
      throw new Error('You should call done() before calling writeToStrategies()');
    }
    if (this.strategiesWritten) {
      throw new Error('Strategies already written');
    }

    this.strategiesWritten = true;

    if (this.strategies.filter(not(false)).length === 0) {
      throw new Error('No strategies to write ' + this.id);
    }
  }

  private writeToStrategies(domains: string[]) {
    this.guardBeforeWritingToStrategies();
    writeDataToStrategies(this.buildStrategyWriteData(domains), this.strategies);
  }

  write(): Promise<unknown> {
    return this.span.traceChildAsync('write all', async (childSpan) => {
      await childSpan.traceChildAsync('done', () => this.done());

      const domains = childSpan.traceChildSync('dump domain trie', () => this.dumpDomains());

      const title = nullthrow(this.title, 'Missing title');
      const descriptions = nullthrow(this.description, 'Missing description');

      if (this.dataSource.size) {
        descriptions.push(
          '',
          'This file contains data from:'
        );
        appendArrayInPlace(descriptions, Array.from(this.dataSource).sort().map((source) => `  - ${source}`));
      }

      // Big outputs offload everything from punycode to the write onto a worker
      // thread: the payload crosses in a few ms (flat string arrays structured-clone
      // cheaply), the main-thread event loop stays free, and the worker writes
      // synchronously so no completion ever waits on a busy main thread.
      //
      // Only worth doing from the main thread -- tasks that already run entirely on
      // a worker (build-microsoft-cdn, build-telegram-cidr, build-cdn-download-conf)
      // are not contending with anything, and must not spawn a nested worker farm.
      if (isMainThread && domains.length >= OUTPUT_WORKER_THRESHOLD) {
        this.guardBeforeWritingToStrategies();

        const payload: OutputWorkerPayload = {
          id: this.id,
          title,
          description: descriptions,
          dateMs: this.date.getTime(),
          strategies: this.strategies.map(serializeStrategy),
          data: this.buildStrategyWriteData(domains)
        };

        return childSpan.traceWorkerChild(
          'write via output worker',
          rawSpan => getOutputWorkerFarm().writeOutput(rawSpan, payload)
        );
      }

      childSpan.traceChildSync('write to strategies', () => this.writeToStrategies(domains));

      return childSpan.traceChildAsync('output to disk', (childSpan) => {
        const promises: Array<Promise<void>> = [];

        for (let i = 0, len = this.strategies.length; i < len; i++) {
          const strategy = this.strategies[i];
          const filePath = resolveStrategyOutputPath(strategy, this.id);

          promises.push(
            childSpan.traceChildAsync('write ' + strategy.name, (childSpan) => Promise.resolve(
              // Already off the main thread: block on the write instead of handing
              // the completion back through libuv.
              isMainThread
                ? strategy.output(childSpan, title, descriptions, this.date, filePath)
                : strategy.outputInWorker(childSpan, title, descriptions, this.date, filePath)
            ))
          );
        }

        return Promise.all(promises);
      });
    });
  }

  async compile(): Promise<Array<string[] | null>> {
    await this.done();
    this.writeToStrategies(this.dumpDomains());

    return this.strategies.reduce<Array<string[] | null>>((acc, strategy) => {
      acc.push(strategy.content);
      return acc;
    }, []);
  }

  withMitmSgmodulePath(moduleName: string | null) {
    if (moduleName) {
      this.withExtraStrategies(new SurgeMitmSgmodule(moduleName));
    }
    return this;
  }
}
