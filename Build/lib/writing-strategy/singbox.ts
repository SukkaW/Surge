import { BaseWriteStrategy } from './base';
import { appendArrayInPlace } from 'foxts/append-array-in-place';
import { noop } from 'foxts/noop';
import { withIdentityContent } from '../misc';
import stringify from 'json-stringify-pretty-compact';
import { OUTPUT_SINGBOX_DIR } from '../../constants/dir';
import { MARKER_DOMAIN } from '../../constants/description';

interface SingboxHeadlessRule {
  domain: string[],
  domain_suffix: string[],
  domain_keyword?: string[],
  domain_regex?: string[],
  source_ip_cidr?: string[],
  ip_cidr?: string[],
  source_port?: number[],
  source_port_range?: string[],
  port?: number[],
  port_range?: string[],
  process_name?: string[],
  process_path?: string[],
  network?: string[]
}

export interface SingboxSourceFormat {
  version: 2 | number & {},
  rules: SingboxHeadlessRule[]
}

export class SingboxSource extends BaseWriteStrategy {
  public readonly name = 'singbox';

  readonly fileExtension = 'json';

  static readonly jsonToLines = (json: unknown): string[] => stringify(json).split('\n');

  private readonly singbox: SingboxHeadlessRule = {
    domain: [MARKER_DOMAIN],
    domain_suffix: [MARKER_DOMAIN]
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

  writeDomainWildcard = noop;
  writeUserAgents = noop;
  writeProcessNames = noop;
  writeProcessPaths = noop;
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
  writeSourceIpCidrs = noop;
  writeSourcePorts = noop;
  writeDestinationPorts = noop;
  writeProtocols = noop;
  writeOtherRules = noop;
}
