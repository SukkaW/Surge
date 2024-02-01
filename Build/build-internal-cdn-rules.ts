import path from 'path';
import { processLine } from './lib/process-line';
import { readFileByLine } from './lib/fetch-text-by-line';
import { sortDomains } from './lib/stable-sort-domain';
import { task } from './trace';
import { compareAndWriteFile } from './lib/create-file';
import { getGorhillPublicSuffixPromise } from './lib/get-gorhill-publicsuffix';

const escapeRegExp = (string = '') => string.replaceAll(/[$()*+.?[\\\]^{|}]/g, '\\$&');

const processLocalDomainSet = async (domainSetPath: string, set: Set<string>) => {
  for await (const l of readFileByLine(domainSetPath)) {
    const line = processLine(l);
    if (line) {
      set.add(line[0] === '.' ? line.slice(1) : line);
    }
  }
};

const processLocalRuleSet = async (ruleSetPath: string, set: Set<string>, keywords: Set<string>) => {
  for await (const line of readFileByLine(ruleSetPath)) {
    if (line.startsWith('DOMAIN-SUFFIX,')) {
      set.add(line.slice(14));
    } else if (line.startsWith('DOMAIN,')) {
      set.add(line.slice(7));
    } else if (line.startsWith('DOMAIN-KEYWORD')) {
      keywords.add(escapeRegExp(line.slice(15)));
    } else if (line.includes('USER-AGENT,') || line.includes('PROCESS-NAME,') || line.includes('URL-REGEX,')) {
      // do nothing
    } else if (processLine(line)) {
      console.warn('[drop line from ruleset]', line);
    }
  }
};

export const buildInternalCDNDomains = task(import.meta.path, async (span) => {
  const proxySet = new Set<string>();
  const proxyKeywords = new Set<string>();

  const gorhill = (await Promise.all([
    getGorhillPublicSuffixPromise(),
    processLocalRuleSet(path.resolve(import.meta.dir, '../List/non_ip/cdn.conf'), proxySet, proxyKeywords),
    processLocalRuleSet(path.resolve(import.meta.dir, '../List/non_ip/global.conf'), proxySet, proxyKeywords),
    processLocalRuleSet(path.resolve(import.meta.dir, '../List/non_ip/global_plus.conf'), proxySet, proxyKeywords),
    processLocalRuleSet(path.resolve(import.meta.dir, '../List/non_ip/my_proxy.conf'), proxySet, proxyKeywords),
    processLocalRuleSet(path.resolve(import.meta.dir, '../List/non_ip/my_plus.conf'), proxySet, proxyKeywords),
    processLocalRuleSet(path.resolve(import.meta.dir, '../List/non_ip/stream.conf'), proxySet, proxyKeywords),
    processLocalRuleSet(path.resolve(import.meta.dir, '../List/non_ip/telegram.conf'), proxySet, proxyKeywords),
    processLocalDomainSet(path.resolve(import.meta.dir, '../List/domainset/cdn.conf'), proxySet),
    processLocalDomainSet(path.resolve(import.meta.dir, '../List/domainset/download.conf'), proxySet)
  ]))[0];

  return compareAndWriteFile(
    span,
    [
      ...sortDomains(Array.from(proxySet), gorhill).map(i => `SUFFIX,${i}`),
      ...Array.from(proxyKeywords).sort().map(i => `REGEX,${i}`)
    ],
    path.resolve(import.meta.dir, '../List/internal/cdn.txt')
  );
});

if (import.meta.main) {
  buildInternalCDNDomains();
}
