import { processLine } from './lib/process-line';
import { fastNormalizeDomain } from './lib/normalize-domain';
import { HostnameSmolTrie } from './lib/trie';
// import { Readable } from 'stream';
import { parse } from 'csv-parse/sync';
import { fetchRemoteTextByLine } from './lib/fetch-text-by-line';
import path from 'node:path';
import { OUTPUT_SURGE_DIR } from './constants/dir';
import { createRetrieKeywordFilter as createKeywordFilter } from 'foxts/retrie';
import { $$fetch } from './lib/fetch-retry';
import runAgainstSourceFile from './lib/run-against-source-file';

export async function parseGfwList() {
  const whiteSet = new Set<string>();
  const trie = new HostnameSmolTrie();

  const excludeGfwList = createKeywordFilter([
    '.*',
    '*',
    '=',
    '[',
    '/',
    '?'
  ]);

  const text = await (await $$fetch('https://raw.githubusercontent.com/gfwlist/gfwlist/master/gfwlist.txt')).text();
  for (const l of atob(text).split('\n')) {
    const line = processLine(l);
    if (!line) continue;

    if (excludeGfwList(line)) {
      continue;
    }
    if (line.startsWith('@@||')) {
      whiteSet.add('.' + line.slice(4));
      continue;
    }
    if (line.startsWith('@@|http://')) {
      whiteSet.add(line.slice(10));
      continue;
    }
    if (line.startsWith('@@|https://')) {
      whiteSet.add(line.slice(11));
      continue;
    }
    if (line.startsWith('||')) {
      trie.add('.' + line.slice(2));
      continue;
    }
    if (line.startsWith('|')) {
      trie.add(line.slice(1));
      continue;
    }
    if (line.startsWith('.')) {
      trie.add(line);
      continue;
    }
    const d = fastNormalizeDomain(line);
    if (d) {
      trie.add(d);
      continue;
    }
  }
  for await (const l of await fetchRemoteTextByLine('https://raw.githubusercontent.com/Loyalsoldier/cn-blocked-domain/release/domains.txt', true)) {
    trie.add(l);
  }
  for await (const l of await fetchRemoteTextByLine('https://raw.githubusercontent.com/Loyalsoldier/v2ray-rules-dat/release/gfw.txt', true)) {
    trie.add(l);
  }

  const topDomainsRes = await (await $$fetch('https://downloads.majestic.com/majestic_million.csv', {
    headers: {
      accept: '*/*',
      'user-agent': 'curl/8.12.1'
    }
  })).text();
  const topDomains = parse(topDomainsRes);

  const keywordSet = new Set<string>();

  const callback = (domain: string, includeAllSubdomain: boolean) => {
    trie.whitelist(domain, includeAllSubdomain);
  };

  await Promise.all([
    runAgainstSourceFile(path.join(OUTPUT_SURGE_DIR, 'non_ip/global.conf'), callback, 'ruleset'),
    runAgainstSourceFile(path.join(OUTPUT_SURGE_DIR, 'non_ip/reject.conf'), callback, 'ruleset'),
    runAgainstSourceFile(path.join(OUTPUT_SURGE_DIR, 'non_ip/telegram.conf'), callback, 'ruleset'),
    runAgainstSourceFile(path.resolve(OUTPUT_SURGE_DIR, 'non_ip/stream.conf'), callback, 'ruleset'),
    runAgainstSourceFile(path.resolve(OUTPUT_SURGE_DIR, 'non_ip/ai.conf'), callback, 'ruleset'),
    runAgainstSourceFile(path.resolve(OUTPUT_SURGE_DIR, 'non_ip/microsoft.conf'), callback, 'ruleset'),
    runAgainstSourceFile(path.resolve(OUTPUT_SURGE_DIR, 'domainset/reject.conf'), callback, 'domainset'),
    runAgainstSourceFile(path.resolve(OUTPUT_SURGE_DIR, 'domainset/reject_extra.conf'), callback, 'domainset'),
    runAgainstSourceFile(path.resolve(OUTPUT_SURGE_DIR, 'domainset/cdn.conf'), callback, 'domainset')
  ]);

  whiteSet.forEach(domain => trie.whitelist(domain));

  const kwfilter = createKeywordFilter([...keywordSet]);

  const missingTop10000Gfwed = new Set<string>();

  for await (const [domain] of topDomains) {
    if (trie.has(domain) && !kwfilter(domain)) {
      missingTop10000Gfwed.add(domain);
    }
  }

  console.log(missingTop10000Gfwed.size, '');
  console.log(Array.from(missingTop10000Gfwed).join('\n'));

  return [
    whiteSet,
    trie,
    missingTop10000Gfwed
  ] as const;
}

if (require.main === module) {
  parseGfwList().catch(console.error);
}
