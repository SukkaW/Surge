import { appendSetElementsToArray } from 'foxts/append-set-elements-to-array';
import { BaseWriteStrategy } from './base';
import { appendArrayInPlace } from 'foxts/append-array-in-place';
import { noop } from 'foxts/noop';
import { isProbablyIpv4 } from 'foxts/is-probably-ip';
import picocolors from 'picocolors';
import { normalizeDomain } from '../normalize-domain';
import { OUTPUT_MODULES_DIR, OUTPUT_SURGE_DIR } from '../../constants/dir';
import { withBannerArray, withIdentityContent } from '../misc';
import { MARKER_DOMAIN } from '../../constants/description';

export class SurgeDomainSet extends BaseWriteStrategy {
  public readonly name = 'surge domainset';

  // readonly type = 'domainset';
  readonly fileExtension = 'conf';
  type = 'domainset';

  protected result: string[] = [MARKER_DOMAIN];

  constructor(outputDir = OUTPUT_SURGE_DIR) {
    super(outputDir);
  }

  withPadding = withBannerArray;

  writeDomain(domain: string): void {
    this.result.push(domain);
  }

  writeDomainSuffix(domain: string): void {
    this.result.push('.' + domain);
  }

  writeDomainKeywords = noop;
  writeDomainWildcard = noop;
  writeUserAgents = noop;
  writeProcessNames = noop;
  writeProcessPaths = noop;
  writeUrlRegexes = noop;
  writeIpCidrs = noop;
  writeIpCidr6s = noop;
  writeGeoip = noop;
  writeIpAsns = noop;
  writeSourceIpCidrs = noop;
  writeSourcePorts = noop;
  writeDestinationPorts = noop;
  writeProtocols = noop;
  writeOtherRules = noop;
}

export class SurgeRuleSet extends BaseWriteStrategy {
  public readonly name: string = 'surge ruleset';

  readonly fileExtension = 'conf';

  protected result: string[] = [`DOMAIN,${MARKER_DOMAIN}`];

  constructor(
    /** Surge RULE-SET can be both ip or non_ip, so this needs to be specified */
    public readonly type: 'ip' | 'non_ip' | (string & {}),
    public readonly outputDir = OUTPUT_SURGE_DIR
  ) {
    super(outputDir);
  }

  withPadding = withBannerArray;

  writeDomain(domain: string): void {
    this.result.push('DOMAIN,' + domain);
  }

  writeDomainSuffix(domain: string): void {
    this.result.push('DOMAIN-SUFFIX,' + domain);
  }

  writeDomainKeywords(keyword: Set<string>): void {
    appendSetElementsToArray(this.result, keyword, i => `DOMAIN-KEYWORD,${i}`);
  }

  writeDomainWildcard(wildcard: string): void {
    this.result.push(`DOMAIN-WILDCARD,${wildcard}`);
  }

  writeUserAgents(userAgent: Set<string>): void {
    appendSetElementsToArray(this.result, userAgent, i => `USER-AGENT,${i}`);
  }

  writeProcessNames(processName: Set<string>): void {
    appendSetElementsToArray(this.result, processName, i => `PROCESS-NAME,${i}`);
  }

  writeProcessPaths(processPath: Set<string>): void {
    appendSetElementsToArray(this.result, processPath, i => `PROCESS-NAME,${i}`);
  }

  writeUrlRegexes(urlRegex: Set<string>): void {
    appendSetElementsToArray(this.result, urlRegex, i => `URL-REGEX,${i}`);
  }

  writeIpCidrs(ipCidr: string[], noResolve: boolean): void {
    for (let i = 0, len = ipCidr.length; i < len; i++) {
      this.result.push(`IP-CIDR,${ipCidr[i]}${noResolve ? ',no-resolve' : ''}`);
    }
  }

  writeIpCidr6s(ipCidr6: string[], noResolve: boolean): void {
    for (let i = 0, len = ipCidr6.length; i < len; i++) {
      this.result.push(`IP-CIDR6,${ipCidr6[i]}${noResolve ? ',no-resolve' : ''}`);
    }
  }

  writeGeoip(geoip: Set<string>, noResolve: boolean): void {
    appendSetElementsToArray(this.result, geoip, i => `GEOIP,${i}${noResolve ? ',no-resolve' : ''}`);
  }

  writeIpAsns(asns: Set<string>, noResolve: boolean): void {
    appendSetElementsToArray(this.result, asns, i => `IP-ASN,${i}${noResolve ? ',no-resolve' : ''}`);
  }

  writeSourceIpCidrs(sourceIpCidr: string[]): void {
    for (let i = 0, len = sourceIpCidr.length; i < len; i++) {
      this.result.push(`SRC-IP,${sourceIpCidr[i]}`);
    }
  }

  writeSourcePorts(port: Set<string>): void {
    appendSetElementsToArray(this.result, port, i => `SRC-PORT,${i}`);
  }

  writeDestinationPorts(port: Set<string>): void {
    appendSetElementsToArray(this.result, port, i => `DEST-PORT,${i}`);
  }

  writeProtocols(protocol: Set<string>): void {
    appendSetElementsToArray(this.result, protocol, i => `PROTOCOL,${i}`);
  }

  writeOtherRules(rule: string[]): void {
    appendArrayInPlace(this.result, rule);
  }
}

export class SurgeMitmSgmodule extends BaseWriteStrategy {
  public readonly name = 'surge sgmodule';

  // readonly type = 'domainset';
  readonly fileExtension = 'sgmodule';
  readonly type = '';

  private rules = new Set<string>();

  protected get result() {
    if (this.rules.size === 0) {
      return null;
    }

    return [
      '#!name=[Sukka] Surge Reject MITM',
      `#!desc=为 URL Regex 规则组启用 MITM (size: ${this.rules.size})`,
      '',
      '[MITM]',
      'hostname = %APPEND% ' + Array.from(this.rules).join(', ')
    ];
  }

  withPadding = withIdentityContent;

  constructor(moduleName: string, outputDir = OUTPUT_MODULES_DIR) {
    super(outputDir);
    this.withFilename(moduleName);
  }

  writeDomain = noop;

  writeDomainSuffix = noop;

  writeDomainKeywords = noop;
  writeDomainWildcard = noop;
  writeUserAgents = noop;
  writeProcessNames = noop;
  writeProcessPaths = noop;
  writeUrlRegexes(urlRegexes: Set<string>): void {
    const urlRegexResults: Array<{ origin: string, processed: string[] }> = [];

    const parsedFailures: Array<[original: string, processed: string]> = [];
    const parsed: Array<[original: string, domain: string]> = [];

    for (let urlRegex of urlRegexes) {
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

      const potentialHostname = urlRegex.slice(0, urlRegex.indexOf('/'))
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
        if (
          normalizeDomain(
            processed
              .replaceAll('*', 'a')
              .replaceAll('?', 'b')
          )
        ) {
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

    for (let i = 0, len = parsed.length; i < len; i++) {
      this.rules.add(parsed[i][1]);
    }
  }

  writeIpCidrs = noop;
  writeIpCidr6s = noop;
  writeGeoip = noop;
  writeIpAsns = noop;
  writeSourceIpCidrs = noop;
  writeSourcePorts = noop;
  writeDestinationPorts = noop;
  writeProtocols = noop;
  writeOtherRules = noop;
}
