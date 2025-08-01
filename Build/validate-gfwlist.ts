import { processLine } from './lib/process-line';
import { fastNormalizeDomain } from './lib/normalize-domain';
import { HostnameSmolTrie } from './lib/trie';
import yauzl from 'yauzl-promise';
import { fetchRemoteTextByLine } from './lib/fetch-text-by-line';
import path from 'node:path';
import { OUTPUT_SURGE_DIR, SOURCE_DIR } from './constants/dir';
import { createRetrieKeywordFilter as createKeywordFilter } from 'foxts/retrie';
import { $$fetch } from './lib/fetch-retry';
import runAgainstSourceFile from './lib/run-against-source-file';
import { nullthrow } from 'foxts/guard';
import { Buffer } from 'node:buffer';

export async function getTopOneMillionDomains() {
  const { parse: csvParser } = await import('csv-parse');

  const topDomainTrie = new HostnameSmolTrie();
  const csvParse = csvParser({ columns: false, skip_empty_lines: true });

  const topDomainsZipBody = await (await $$fetch('https://tranco-list.eu/top-1m.csv.zip', {
    headers: {
      accept: '*/*',
      'user-agent': 'curl/8.12.1'
    }
  })).arrayBuffer();
  let entry: yauzl.Entry | null = null;
  for await (const e of await yauzl.fromBuffer(Buffer.from(topDomainsZipBody))) {
    if (e.filename === 'top-1m.csv') {
      entry = e;
      break;
    }
  }

  const { promise, resolve, reject } = Promise.withResolvers<HostnameSmolTrie>();

  const readable = await nullthrow(entry, 'top-1m.csv entry not found').openReadStream();
  const parser = readable.pipe(csvParse);
  parser.on('readable', () => {
    let record;
    while ((record = parser.read()) !== null) {
      topDomainTrie.add(record[1]);
    }
  });

  parser.on('end', () => {
    resolve(topDomainTrie);
  });
  parser.on('error', (err) => {
    reject(err);
  });

  return promise;
}

export async function parseGfwList() {
  const whiteSet = new Set<string>();
  const gfwListTrie = new HostnameSmolTrie();

  const gfwlistIgnoreLineKwfilter = createKeywordFilter([
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

    if (gfwlistIgnoreLineKwfilter(line)) {
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
      gfwListTrie.add('.' + line.slice(2));
      continue;
    }
    if (line.startsWith('|')) {
      gfwListTrie.add(line.slice(1));
      continue;
    }
    if (line.startsWith('.')) {
      gfwListTrie.add(line);
      continue;
    }
    const d = fastNormalizeDomain(line);
    if (d) {
      gfwListTrie.add(d);
      continue;
    }
  }
  for await (const l of await fetchRemoteTextByLine('https://raw.githubusercontent.com/Loyalsoldier/cn-blocked-domain/release/domains.txt', true)) {
    gfwListTrie.add(l);
  }
  for await (const l of await fetchRemoteTextByLine('https://raw.githubusercontent.com/Loyalsoldier/v2ray-rules-dat/release/gfw.txt', true)) {
    gfwListTrie.add(l);
  }

  const topDomainTrie = await getTopOneMillionDomains();

  const keywordSet = new Set<string>();

  const callback = (domain: string, includeAllSubdomain: boolean) => {
    gfwListTrie.whitelist(domain, includeAllSubdomain);
    topDomainTrie.whitelist(domain, includeAllSubdomain);
  };
  await Promise.all([
    runAgainstSourceFile(path.join(SOURCE_DIR, 'non_ip/global.conf'), callback, 'ruleset', keywordSet),
    // runAgainstSourceFile(path.join(OUTPUT_SURGE_DIR, 'non_ip/domestic.conf'), callback, 'ruleset', keywordSet),
    runAgainstSourceFile(path.join(SOURCE_DIR, 'non_ip/reject.conf'), callback, 'ruleset', keywordSet),
    runAgainstSourceFile(path.join(SOURCE_DIR, 'non_ip/telegram.conf'), callback, 'ruleset', keywordSet),
    runAgainstSourceFile(path.resolve(OUTPUT_SURGE_DIR, 'non_ip/stream.conf'), callback, 'ruleset', keywordSet),
    runAgainstSourceFile(path.resolve(SOURCE_DIR, 'non_ip/ai.conf'), callback, 'ruleset', keywordSet),
    runAgainstSourceFile(path.resolve(SOURCE_DIR, 'non_ip/microsoft.conf'), callback, 'ruleset', keywordSet),
    runAgainstSourceFile(path.resolve(SOURCE_DIR, 'non_ip/apple_services.conf'), callback, 'ruleset', keywordSet),
    runAgainstSourceFile(path.resolve(OUTPUT_SURGE_DIR, 'domainset/reject.conf'), callback, 'domainset'),
    runAgainstSourceFile(path.resolve(OUTPUT_SURGE_DIR, 'domainset/reject_extra.conf'), callback, 'domainset'),
    runAgainstSourceFile(path.resolve(OUTPUT_SURGE_DIR, 'domainset/cdn.conf'), callback, 'domainset')
  ]);

  whiteSet.forEach(domain => gfwListTrie.whitelist(domain, true));

  const kwfilter = createKeywordFilter([...keywordSet]);

  const missingTop10000Gfwed = new Set<string>();

  topDomainTrie.dump((domain) => {
    if (gfwListTrie.has(domain) && !kwfilter(domain)) {
      missingTop10000Gfwed.add(domain);
    }
  });

  console.log(missingTop10000Gfwed.size, '');
  console.log(Array.from(missingTop10000Gfwed).join('\n'));

  return [
    whiteSet,
    gfwListTrie,
    missingTop10000Gfwed
  ] as const;
}

if (require.main === module) {
  parseGfwList().catch(console.error);
}
