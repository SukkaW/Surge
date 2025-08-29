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

  writeDomainWildcard(wildcard: string): void {
    this.singbox.domain_regex ??= [];
    this.singbox.domain_regex.push(SingboxSource.domainWildCardToRegex(wildcard));
  }

  writeUserAgents = noop;

  writeProcessNames = noop;
  // writeProcessNames(processName: Set<string>): void {
  //   appendArrayInPlace(
  //     this.singbox.process_name ??= [],
  //     Array.from(processName)
  //   );
  // }

  writeProcessPaths = noop;
  // writeProcessPaths(processPath: Set<string>): void {
  //   appendArrayInPlace(
  //     this.singbox.process_path ??= [],
  //     Array.from(processPath)
  //   );
  // }

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
  // writeSourceIpCidrs(sourceIpCidr: string[]): void {
  //   this.singbox.source_ip_cidr ??= [];
  //   for (let i = 0, len = sourceIpCidr.length; i < len; i++) {
  //     const value = sourceIpCidr[i];
  //     if (value.includes('/')) {
  //       this.singbox.source_ip_cidr.push(value);
  //       continue;
  //     }
  //     const v = fastIpVersion(value);
  //     if (v === 4) {
  //       this.singbox.source_ip_cidr.push(`${value}/32`);
  //       continue;
  //     }
  //     if (v === 6) {
  //       this.singbox.source_ip_cidr.push(`${value}/128`);
  //       continue;
  //     }
  //   }
  // }

  writeSourcePorts = noop;
  // writeSourcePorts(port: Set<string>): void {
  //   this.singbox.source_port ??= [];

  //   for (const i of port) {
  //     const tmp = Number(i);
  //     if (!Number.isNaN(tmp)) {
  //       this.singbox.source_port.push(tmp);
  //     }
  //   }
  // }

  writeDestinationPorts = noop;
  // writeDestinationPorts(port: Set<string>): void {
  //   this.singbox.port ??= [];

  //   for (const i of port) {
  //     const tmp = Number(i);
  //     if (!Number.isNaN(tmp)) {
  //       this.singbox.port.push(tmp);
  //     }
  //   }
  // }

  writeProtocols = noop;
  // writeProtocols(protocol: Set<string>): void {
  //   this.singbox.network ??= [];
  //   // protocol has already be normalized and will only be uppercase
  //   if (protocol.has('UDP')) {
  //     this.singbox.network.push('udp');
  //   }
  //   if (protocol.has('TCP')) {
  //     this.singbox.network.push('tcp');
  //   }
  // }

  writeOtherRules = noop;
}
