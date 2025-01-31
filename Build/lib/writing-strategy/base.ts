import type { Span } from '../../trace';
import { compareAndWriteFile } from '../create-file';

export abstract class BaseWriteStrategy {
  public overwriteFilename: string | null = null;
  public abstract readonly type: 'domainset' | 'non_ip' | 'ip' | (string & {});

  abstract readonly fileExtension: 'conf' | 'txt' | 'json' | (string & {});

  constructor(public readonly outputDir: string) {}

  protected abstract result: string[] | null;

  abstract writeDomain(domain: string): void;
  abstract writeDomainSuffix(domain: string): void;
  abstract writeDomainKeywords(keyword: Set<string>): void;
  abstract writeDomainWildcards(wildcard: Set<string>): void;
  abstract writeUserAgents(userAgent: Set<string>): void;
  abstract writeProcessNames(processName: Set<string>): void;
  abstract writeProcessPaths(processPath: Set<string>): void;
  abstract writeUrlRegexes(urlRegex: Set<string>): void;
  abstract writeIpCidrs(ipCidr: string[], noResolve: boolean): void;
  abstract writeIpCidr6s(ipCidr6: string[], noResolve: boolean): void;
  abstract writeGeoip(geoip: Set<string>, noResolve: boolean): void;
  abstract writeIpAsns(asns: Set<string>, noResolve: boolean): void;
  abstract writeSourceIpCidrs(sourceIpCidr: string[]): void;
  abstract writeSourcePorts(port: Set<string>): void;
  abstract writeDestinationPorts(port: Set<string>): void;
  abstract writeOtherRules(rule: string[]): void;

  static readonly domainWildCardToRegex = (domain: string) => {
    let result = '^';
    for (let i = 0, len = domain.length; i < len; i++) {
      switch (domain[i]) {
        case '.':
          result += String.raw`\.`;
          break;
        case '*':
          result += String.raw`[\w.-]*?`;
          break;
        case '?':
          result += String.raw`[\w.-]`;
          break;
        default:
          result += domain[i];
      }
    }
    result += '$';
    return result;
  };

  protected abstract withPadding(title: string, description: string[] | readonly string[], date: Date, content: string[]): string[];

  public output(
    span: Span,
    title: string,
    description: string[] | readonly string[],
    date: Date,
    filePath: string
  ): void | Promise<void> {
    if (!this.result) {
      return;
    }
    return compareAndWriteFile(
      span,
      this.withPadding(
        title,
        description,
        date,
        this.result
      ),
      filePath
    );
  };

  public get content() {
    return this.result;
  }
}
