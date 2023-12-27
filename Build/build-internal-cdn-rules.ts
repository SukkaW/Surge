import path from 'path';
import * as tldts from 'tldts';
import { processLine } from './lib/process-line';
import { readFileByLine } from './lib/fetch-text-by-line';
import { sortDomains } from './lib/stable-sort-domain';
import { task } from './lib/trace-runner';
import { compareAndWriteFile } from './lib/create-file';
import { getGorhillPublicSuffixPromise } from './lib/get-gorhill-publicsuffix';
// const { createCachedGorhillGetDomain } = require('./lib/cached-tld-parse');

const escapeRegExp = (string = '') => string.replaceAll(/[$()*+.?[\\\]^{|}]/g, '\\$&');

const addApexDomain = (input: string, set: Set<string>) => {
  // We are including the private domains themselves
  const d = tldts.getDomain(input, { allowPrivateDomains: false });
  if (d) {
    set.add(d);
  }
};

const processLocalDomainSet = async (domainSetPath: string, set: Set<string>) => {
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

const processLocalRuleSet = async (ruleSetPath: string, set: Set<string>, keywords: Set<string>) => {
  for await (const line of readFileByLine(ruleSetPath)) {
    if (line.startsWith('DOMAIN-SUFFIX,')) {
      addApexDomain(line.replace('DOMAIN-SUFFIX,', ''), set);
    } else if (line.startsWith('DOMAIN,')) {
      addApexDomain(line.replace('DOMAIN,', ''), set);
    } else if (line.startsWith('DOMAIN-KEYWORD')) {
      keywords.add(escapeRegExp(line.replace('DOMAIN-KEYWORD,', '')));
    } else if (line.startsWith('USER-AGENT,') || line.startsWith('PROCESS-NAME,') || line.startsWith('URL-REGEX,')) {
      // do nothing
    } else if (processLine(line)) {
      console.warn('[drop line from ruleset]', line);
    }
  }
};

export const buildInternalCDNDomains = task(import.meta.path, async () => {
  const proxySet = new Set<string>();
  const proxyKeywords = new Set<string>();

  const gorhill = (await Promise.all([
    getGorhillPublicSuffixPromise(),
    processLocalRuleSet(path.resolve(import.meta.dir, '../List/non_ip/cdn.conf'), proxySet, proxyKeywords),
    processLocalRuleSet(path.resolve(import.meta.dir, '../List/non_ip/global.conf'), proxySet, proxyKeywords),
    processLocalRuleSet(path.resolve(import.meta.dir, '../List/non_ip/global_plus.conf'), proxySet, proxyKeywords),
    processLocalRuleSet(path.resolve(import.meta.dir, '../List/non_ip/my_proxy.conf'), proxySet, proxyKeywords),
    processLocalRuleSet(path.resolve(import.meta.dir, '../List/non_ip/stream.conf'), proxySet, proxyKeywords),
    processLocalRuleSet(path.resolve(import.meta.dir, '../List/non_ip/telegram.conf'), proxySet, proxyKeywords),
    processLocalDomainSet(path.resolve(import.meta.dir, '../List/domainset/cdn.conf'), proxySet),
    processLocalDomainSet(path.resolve(import.meta.dir, '../List/domainset/download.conf'), proxySet)
  ]))[0];

  return compareAndWriteFile(
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
