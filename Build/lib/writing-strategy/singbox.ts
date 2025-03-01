import { BaseWriteStrategy } from './base';
import { appendArrayInPlace } from '../append-array-in-place';
import { noop } from 'foxts/noop';
import { fastIpVersion, withIdentityContent } from '../misc';
import stringify from 'json-stringify-pretty-compact';
import { OUTPUT_SINGBOX_DIR } from '../../constants/dir';

interface SingboxHeadlessRule {
  domain: string[], // this_ruleset_is_made_by_sukkaw.ruleset.skk.moe
  domain_suffix: string[], // this_ruleset_is_made_by_sukkaw.ruleset.skk.moe
  domain_keyword?: string[],
  domain_regex?: string[],
  source_ip_cidr?: string[],
  ip_cidr?: string[],
  source_port?: number[],
  source_port_range?: string[],
  port?: number[],
  port_range?: string[],
  process_name?: string[],
  process_path?: string[]
}

export interface SingboxSourceFormat {
  version: 2 | number & {},
  rules: SingboxHeadlessRule[]
}

export class SingboxSource extends BaseWriteStrategy {
  public readonly name = 'singbox';

  readonly fileExtension = 'json';

  static readonly jsonToLines = (json: unknown): string[] => stringify(json).split('\n');

  private singbox: SingboxHeadlessRule = {
    domain: ['this_ruleset_is_made_by_sukkaw.ruleset.skk.moe'],
    domain_suffix: ['this_ruleset_is_made_by_sukkaw.ruleset.skk.moe']
  };

  protected get result() {
    return SingboxSource.jsonToLines({
      version: 2,
      rules: [this.singbox]
    });
  }

  constructor(
    /** Since sing-box only have one format that does not reflect type, we need to specify it */
    public type: 'domainset' | 'non_ip' | 'ip' /* | (string & {}) */,
    public readonly outputDir = OUTPUT_SINGBOX_DIR
  ) {
    super(outputDir);
  }

  withPadding = withIdentityContent;

  writeDomain(domain: string): void {
    this.singbox.domain.push(domain);
  }

  writeDomainSuffix(domain: string): void {
    this.singbox.domain_suffix.push(domain);
  }

  writeDomainKeywords(keyword: Set<string>): void {
    appendArrayInPlace(
      this.singbox.domain_keyword ??= [],
      Array.from(keyword)
    );
  }

  writeDomainWildcards(wildcard: Set<string>): void {
    appendArrayInPlace(
      this.singbox.domain_regex ??= [],
      Array.from(wildcard, SingboxSource.domainWildCardToRegex)
    );
  }

  writeUserAgents = noop;

  writeProcessNames(processName: Set<string>): void {
    appendArrayInPlace(
      this.singbox.process_name ??= [],
      Array.from(processName)
    );
  }

  writeProcessPaths(processPath: Set<string>): void {
    appendArrayInPlace(
      this.singbox.process_path ??= [],
      Array.from(processPath)
    );
  }

  writeUrlRegexes = noop;

  writeIpCidrs(ipCidr: string[]): void {
    appendArrayInPlace(
      this.singbox.ip_cidr ??= [],
      ipCidr
    );
  }

  writeIpCidr6s(ipCidr6: string[]): void {
    appendArrayInPlace(
      this.singbox.ip_cidr ??= [],
      ipCidr6
    );
  }

  writeGeoip = noop;

  writeIpAsns = noop;

  writeSourceIpCidrs(sourceIpCidr: string[]): void {
    this.singbox.source_ip_cidr ??= [];
    for (let i = 0, len = sourceIpCidr.length; i < len; i++) {
      const value = sourceIpCidr[i];
      if (value.includes('/')) {
        this.singbox.source_ip_cidr.push(value);
        continue;
      }
      const v = fastIpVersion(value);
      if (v === 4) {
        this.singbox.source_ip_cidr.push(`${value}/32`);
        continue;
      }
      if (v === 6) {
        this.singbox.source_ip_cidr.push(`${value}/128`);
        continue;
      }
    }
  }

  writeSourcePorts(port: Set<string>): void {
    this.singbox.source_port ??= [];

    for (const i of port) {
      const tmp = Number(i);
      if (!Number.isNaN(tmp)) {
        this.singbox.source_port.push(tmp);
      }
    }
  }

  writeDestinationPorts(port: Set<string>): void {
    this.singbox.port ??= [];

    for (const i of port) {
      const tmp = Number(i);
      if (!Number.isNaN(tmp)) {
        this.singbox.port.push(tmp);
      }
    }
  }

  writeOtherRules = noop;
}
