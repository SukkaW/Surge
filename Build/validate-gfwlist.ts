import { processLine } from './lib/process-line';
import { normalizeDomain } from './lib/normalize-domain';
import { HostnameSmolTrie } from './lib/trie';
// import { Readable } from 'stream';
import { parse } from 'csv-parse/sync';
import { readFileByLine } from './lib/fetch-text-by-line';
import path from 'node:path';
import { OUTPUT_SURGE_DIR } from './constants/dir';
import { $fetch } from './lib/make-fetch-happen';
import { createRetrieKeywordFilter as createKeywordFilter } from 'foxts/retrie';

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

  const text = await (await $fetch('https://raw.githubusercontent.com/gfwlist/gfwlist/master/gfwlist.txt')).text();
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
    const d = normalizeDomain(line);
    if (d) {
      trie.add(d);
      continue;
    }
  }
  for (const l of (await (await $fetch('https://raw.githubusercontent.com/Loyalsoldier/cn-blocked-domain/release/domains.txt')).text()).split('\n')) {
    trie.add(l);
  }

  const res = await (await $fetch('https://litter.catbox.moe/sqmgyn.csv', {
    headers: {
      accept: '*/*',
      'user-agent': 'curl/8.9.1'
    }
  })).text();
  const topDomains = parse(res);

  const keywordSet = new Set<string>();

  const runAgainstRuleset = async (ruleset: string) => {
    for await (const l of readFileByLine(ruleset)) {
      const line = processLine(l);
      if (!line) continue;
      const [type, domain] = line.split(',');
      switch (type) {
        case 'DOMAIN-SUFFIX': {
          trie.whitelist('.' + domain);
          break;
        }
        case 'DOMAIN': {
          trie.whitelist(domain);
          break;
        }
        case 'DOMAIN-KEYWORD': {
          keywordSet.add(domain);
          break;
        }
        // no default
      }
    }
  };

  const runAgainstDomainset = async (ruleset: string) => {
    for await (const l of readFileByLine(ruleset)) {
      const line = processLine(l);
      if (!line) continue;
      trie.whitelist(line);
    }
  };
  await Promise.all([
    runAgainstRuleset(path.join(OUTPUT_SURGE_DIR, 'non_ip/global.conf')),
    runAgainstRuleset(path.join(OUTPUT_SURGE_DIR, 'non_ip/reject.conf')),
    runAgainstRuleset(path.join(OUTPUT_SURGE_DIR, 'non_ip/telegram.conf')),
    runAgainstRuleset(path.resolve(OUTPUT_SURGE_DIR, 'non_ip/stream.conf')),
    runAgainstRuleset(path.resolve(OUTPUT_SURGE_DIR, 'non_ip/ai.conf')),
    runAgainstRuleset(path.resolve(OUTPUT_SURGE_DIR, 'non_ip/microsoft.conf')),
    runAgainstDomainset(path.resolve(OUTPUT_SURGE_DIR, 'domainset/reject.conf')),
    runAgainstDomainset(path.resolve(OUTPUT_SURGE_DIR, 'domainset/cdn.conf'))
  ]);

  whiteSet.forEach(domain => trie.whitelist(domain));

  const kwfilter = createKeywordFilter([...keywordSet]);

  const missingTop10000Gfwed = new Set<string>();

  console.log(trie.has('.mojim.com'));

  for await (const [domain] of topDomains) {
    if (trie.has(domain) && !kwfilter(domain)) {
      missingTop10000Gfwed.add(domain);
    }
  }

  console.log(JSON.stringify(Array.from(missingTop10000Gfwed), null, 2));

  return [
    whiteSet,
    trie,
    missingTop10000Gfwed
  ] as const;
}

if (require.main === module) {
  parseGfwList().catch(console.error);
}
