import type { Span } from '../../trace';
import { compareAndWriteFile } from '../create-file';
import { compareAndWriteFileInWorker } from '../create-file.worker';

/**
 * The class is not about holding rule data, instead it determines how the
 * date is written to a file.
 */
export abstract class BaseWriteStrategy {
  public abstract readonly name: string;

  /**
   * Sometimes a ruleset will create extra files (e.g. reject-url-regex w/ mitm.sgmodule),
   * and doesn't share the same filename and id. This property is used to overwrite the filename.
   */
  public overwriteFilename: string | null = null;
  public withFilename(filename: string) {
    this.overwriteFilename = filename;
    return this;
  }

  public abstract readonly type: 'domainset' | 'non_ip' | 'ip' | (string & {});

  abstract readonly fileExtension: 'conf' | 'txt' | 'json' | 'sgmodule'; /* | (string & {}) */

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
  abstract writeProtocols(protocol: Set<string>): void;
  abstract writeOtherRules(rule: string[]): void;

  protected abstract withPadding(title: string, description: string[] | readonly string[], date: Date, content: string[]): string[];

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

    if (this.result.length > 1000) {
      return compareAndWriteFileInWorker(
        span,
        this.withPadding(
          title,
          description,
          date,
          this.result
        ),
        filePath
      );
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
