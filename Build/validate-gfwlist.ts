import { processLine } from './lib/process-line';
import { normalizeDomain } from './lib/normalize-domain';
import { createTrie } from './lib/trie';
// import { Readable } from 'stream';
import { parse } from 'csv-parse/sync';
import { readFileByLine } from './lib/fetch-text-by-line';
import path from 'path';

export const parseGfwList = async () => {
  const whiteSet = new Set<string>();
  const blackSet = new Set<string>();

  const text = await (await fetch('https://raw.githubusercontent.com/gfwlist/gfwlist/master/gfwlist.txt')).text();
  for (const l of atob(text).split('\n')) {
    const line = processLine(l);
    if (!line) continue;
    if (line[0] === '[') {
      continue;
    }
    if (line.includes('.*')) {
      continue;
    }
    if (line.includes('*')) {
      continue;
    }
    if (line.startsWith('@@||')) {
      whiteSet.add(line.slice(4));
      continue;
    }
    if (line.startsWith('@@|http://')) {
      whiteSet.add(line.slice(8));
      continue;
    }
    if (line.startsWith('@@|https://')) {
      whiteSet.add(line.slice(9));
      continue;
    }
    if (line.startsWith('||')) {
      blackSet.add(line.slice(2));
      continue;
    }
    if (line.startsWith('|')) {
      blackSet.add(line.slice(1));
      continue;
    }
    if (line.startsWith('.')) {
      blackSet.add(line.slice(1));
      continue;
    }
    const d = normalizeDomain(line);
    if (d) {
      blackSet.add(d);
      continue;
    }
  }
  for (const l of (await (await fetch('https://raw.githubusercontent.com/Loyalsoldier/cn-blocked-domain/release/domains.txt')).text()).split('\n')) {
    blackSet.add(l);
  }

  const top500Gfwed = new Set<string>();

  const res = await (await fetch('https://radar.cloudflare.com/charts/LargerTopDomainsTable/attachment?id=1077&top=10000', {
    headers: {
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'accept-language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7,zh-TW;q=0.6,es;q=0.5',
      'sec-ch-ua': '"Google Chrome";v="123", "Not:A-Brand";v="8", "Chromium";v="123"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"macOS"',
      'sec-fetch-dest': 'document',
      'sec-fetch-mode': 'navigate',
      'sec-fetch-site': 'none',
      'sec-fetch-user': '?1',
      'upgrade-insecure-requests': '1'
    }
  })).text();
  const topDomains = parse(res);

  const trie = createTrie(blackSet, true);

  for await (const [domain] of topDomains) {
    if (trie.has(domain)) {
      top500Gfwed.add(domain);
    }
  }

  const notIncludedTop500Gfwed = new Set<string>(top500Gfwed);

  const runAgainstRuleset = async (ruleset: string) => {
    for await (const l of readFileByLine(ruleset)) {
      const line = processLine(l);
      if (!line) continue;
      const [type, domain] = line.split(',');
      if (type === 'DOMAIN-SUFFIX') {
        if (top500Gfwed.has(domain)) {
          notIncludedTop500Gfwed.delete(domain);
        }
      } else if (type === 'DOMAIN-KEYWORD') {
        for (const d of top500Gfwed) {
          if (d.includes(domain)) {
            notIncludedTop500Gfwed.delete(d);
          }
        }
      }
    }
  };

  await Promise.all([
    runAgainstRuleset(path.resolve(import.meta.dir, '../Source/non_ip/global.conf')),
    runAgainstRuleset(path.resolve(import.meta.dir, '../Source/non_ip/telegram.conf')),
    runAgainstRuleset(path.resolve(import.meta.dir, '../List/non_ip/stream.conf'))
  ]);

  console.log(notIncludedTop500Gfwed);

  return [
    whiteSet,
    blackSet,
    trie,
    top500Gfwed
  ] as const;
};
