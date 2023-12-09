import fsp from 'fs/promises';
import path from 'path';
import * as tldts from 'tldts';
import { processLine } from './lib/process-line';
import { readFileByLine } from './lib/fetch-text-by-line';
import { createDomainSorter } from './lib/stable-sort-domain';
import { task } from './lib/trace-runner';
import { compareAndWriteFile } from './lib/create-file';
import { getGorhillPublicSuffixPromise } from './lib/get-gorhill-publicsuffix';
// const { createCachedGorhillGetDomain } = require('./lib/cached-tld-parse');

const escapeRegExp = (string = '') => string.replaceAll(/[$()*+.?[\\\]^{|}]/g, '\\$&');

export const buildInternalCDNDomains = task(import.meta.path, async () => {
  const set = new Set<string>();
  const keywords = new Set<string>();

  const gorhill = await getGorhillPublicSuffixPromise();
  const domainSorter = createDomainSorter(gorhill);

  const addApexDomain = (input: string) => {
    // We are including the private domains themselves
    const d = tldts.getDomain(input, { allowPrivateDomains: false });
    if (d) {
      set.add(d);
    }
  };

  const processLocalDomainSet = async (domainSetPath: string) => {
    for await (const line of readFileByLine(domainSetPath)) {
      // console.log({ line });

      const parsed = tldts.parse(line, { allowPrivateDomains: true, detectIp: false });
      if (parsed.isIp) continue;
      if (parsed.isIcann || parsed.isPrivate) {
        if (parsed.domain) {
          set.add(parsed.domain);
        }
        continue;
      }

      if (processLine(line)) {
        console.warn('[drop line from domainset]', line);
      }
    }
  };

  const processLocalRuleSet = async (ruleSetPath: string) => {
    for await (const line of readFileByLine(ruleSetPath)) {
      if (line.startsWith('DOMAIN-SUFFIX,')) {
        addApexDomain(line.replace('DOMAIN-SUFFIX,', ''));
      } else if (line.startsWith('DOMAIN,')) {
        addApexDomain(line.replace('DOMAIN,', ''));
      } else if (line.startsWith('DOMAIN-KEYWORD')) {
        keywords.add(escapeRegExp(line.replace('DOMAIN-KEYWORD,', '')));
      } else if (line.startsWith('USER-AGENT,') || line.startsWith('PROCESS-NAME,') || line.startsWith('URL-REGEX,')) {
        // do nothing
      } else if (processLine(line)) {
        console.warn('[drop line from ruleset]', line);
      }
    }
  };

  await Promise.all([
    processLocalRuleSet(path.resolve(import.meta.dir, '../List/non_ip/cdn.conf')),
    processLocalRuleSet(path.resolve(import.meta.dir, '../List/non_ip/global.conf')),
    processLocalRuleSet(path.resolve(import.meta.dir, '../List/non_ip/global_plus.conf')),
    processLocalRuleSet(path.resolve(import.meta.dir, '../List/non_ip/my_proxy.conf')),
    processLocalRuleSet(path.resolve(import.meta.dir, '../List/non_ip/stream.conf')),
    processLocalRuleSet(path.resolve(import.meta.dir, '../List/non_ip/telegram.conf')),
    processLocalDomainSet(path.resolve(import.meta.dir, '../List/domainset/cdn.conf')),
    processLocalDomainSet(path.resolve(import.meta.dir, '../List/domainset/download.conf')),

    fsp.mkdir(path.resolve(import.meta.dir, '../List/internal'), { recursive: true })
  ]);

  return compareAndWriteFile(
    [
      ...Array.from(set).sort(domainSorter).map(i => `SUFFIX,${i}`),
      ...Array.from(keywords).sort().map(i => `REGEX,${i}`)
    ],
    path.resolve(import.meta.dir, '../List/internal/cdn.txt')
  );
});

if (import.meta.main) {
  buildInternalCDNDomains();
}
