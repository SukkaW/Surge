import { SOURCE_DIR } from '../constants/dir';
import path from 'node:path';
import { fdir as Fdir } from 'fdir';
import runAgainstSourceFile from './run-against-source-file';

export interface SourceDomain {
  domain: string,
  /**
   * `true` for `DOMAIN-SUFFIX` / leading-dot domainset entries (apex domain
   * that includes all subdomains), `false` for exact `DOMAIN` entries.
   */
  includeAllSubdomain: boolean
}

function sourceFileFilter(filePath: string, isDirectory: boolean) {
  if (isDirectory) return false;
  const extname = path.extname(filePath);
  return extname === '.txt' || extname === '.conf';
}

/**
 * Crawl the `domainset` and `non_ip` source directories and return every
 * domain entry they declare.
 *
 * A domain that appears with `includeAllSubdomain: true` in any source wins
 * over an exact-only occurrence: checking the apex (with subdomains) also
 * covers the exact host, so we collapse duplicates to the broader check. This
 * is the natural dedupe that makes sharding by domain hash correct.
 */
export async function enumerateSourceDomains(): Promise<SourceDomain[]> {
  const [domainSets, domainRules] = await Promise.all([
    new Fdir()
      .withFullPaths()
      .filter(sourceFileFilter)
      .crawl(SOURCE_DIR + path.sep + 'domainset')
      .withPromise(),
    new Fdir()
      .withFullPaths()
      .filter(sourceFileFilter)
      .crawl(SOURCE_DIR + path.sep + 'non_ip')
      .withPromise()
  ]);

  // domain -> includeAllSubdomain (true wins)
  const seen = new Map<string, boolean>();

  await Promise.all(
    [...domainRules, ...domainSets].map(filepath => runAgainstSourceFile(
      filepath,
      (domain: string, includeAllSubdomain: boolean) => {
        const prev = seen.get(domain);
        if (prev === undefined) {
          seen.set(domain, includeAllSubdomain);
        } else if (includeAllSubdomain && !prev) {
          seen.set(domain, true);
        }
      }
    ))
  );

  const result: SourceDomain[] = [];
  for (const [domain, includeAllSubdomain] of seen) {
    result.push({ domain, includeAllSubdomain });
  }
  return result;
}
