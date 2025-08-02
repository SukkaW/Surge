import { appendSetElementsToArray } from 'foxts/append-set-elements-to-array';
import { BaseWriteStrategy } from './base';
import { noop } from 'foxts/noop';
import { notSupported, withBannerArray } from '../misc';
import { fastIpVersion } from 'foxts/fast-ip-version';
import { OUTPUT_CLASH_DIR } from '../../constants/dir';
import { appendArrayInPlace } from 'foxts/append-array-in-place';
import { MARKER_DOMAIN } from '../../constants/description';

export class ClashDomainSet extends BaseWriteStrategy {
  public readonly name = 'clash domainset';

  // readonly type = 'domainset';
  readonly fileExtension = 'txt';
  readonly type = 'domainset';

  protected result: string[] = [MARKER_DOMAIN];

  constructor(public readonly outputDir = OUTPUT_CLASH_DIR) {
    super(outputDir);
  }

  withPadding = withBannerArray;

  writeDomain(domain: string): void {
    this.result.push(domain);
  }

  writeDomainSuffix(domain: string): void {
    this.result.push('+.' + domain);
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

export class ClashIPSet extends BaseWriteStrategy {
  public readonly name = 'clash ipcidr';

  // readonly type = 'domainset';
  readonly fileExtension = 'txt';
  readonly type = 'ip';

  protected result: string[] = [];

  constructor(public readonly outputDir = OUTPUT_CLASH_DIR) {
    super(outputDir);
  }

  withPadding = withBannerArray;

  writeDomain = notSupported('writeDomain');
  writeDomainSuffix = notSupported('writeDomainSuffix');
  writeDomainKeywords = notSupported('writeDomainKeywords');
  writeDomainWildcard = notSupported('writeDomainWildcards');
  writeUserAgents = notSupported('writeUserAgents');
  writeProcessNames = notSupported('writeProcessNames');
  writeProcessPaths = notSupported('writeProcessPaths');
  writeUrlRegexes = notSupported('writeUrlRegexes');
  writeIpCidrs(ipCidr: string[]): void {
    appendArrayInPlace(this.result, ipCidr);
  }

  writeIpCidr6s(ipCidr6: string[]): void {
    appendArrayInPlace(this.result, ipCidr6);
  }

  writeGeoip = notSupported('writeGeoip');
  writeIpAsns = notSupported('writeIpAsns');
  writeSourceIpCidrs = notSupported('writeSourceIpCidrs');
  writeSourcePorts = notSupported('writeSourcePorts');
  writeDestinationPorts = noop;
  writeProtocols = noop;
  writeOtherRules = noop;
}

export class ClashClassicRuleSet extends BaseWriteStrategy {
  public readonly name: string = 'clash classic ruleset';

  readonly fileExtension = 'txt';

  protected result: string[] = [`DOMAIN,${MARKER_DOMAIN}`];

  constructor(public readonly type: 'ip' | 'non_ip' /* | (string & {}) */, public readonly outputDir = OUTPUT_CLASH_DIR) {
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

  writeUserAgents = noop;

  writeProcessNames(processName: Set<string>): void {
    appendSetElementsToArray(this.result, processName, i => `PROCESS-NAME,${i}`);
  }

  writeProcessPaths(processPath: Set<string>): void {
    appendSetElementsToArray(this.result, processPath, i => `PROCESS-PATH,${i}`);
  }

  writeUrlRegexes = noop;

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
      const value = sourceIpCidr[i];
      if (value.includes('/')) {
        this.result.push(`SRC-IP-CIDR,${value}`);
        continue;
      }
      const v = fastIpVersion(value);
      if (v === 4) {
        this.result.push(`SRC-IP-CIDR,${value}/32`);
        continue;
      }
      if (v === 6) {
        this.result.push(`SRC-IP-CIDR6,${value}/128`);
        continue;
      }
    }
  }

  writeSourcePorts(port: Set<string>): void {
    appendSetElementsToArray(this.result, port, i => `SRC-PORT,${i}`);
  }

  writeDestinationPorts(port: Set<string>): void {
    appendSetElementsToArray(this.result, port, i => `DST-PORT,${i}`);
  }

  writeProtocols(protocol: Set<string>): void {
    // Mihomo only matches UDP/TCP: https://wiki.metacubex.one/en/config/rules/#network

    // protocol has already be normalized and will only contain upppercase
    if (protocol.has('UDP')) {
      this.result.push('NETWORK,UDP');
    }
    if (protocol.has('TCP')) {
      this.result.push('NETWORK,TCP');
    }
  }

  writeOtherRules = noop;
}
