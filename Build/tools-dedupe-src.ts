import { fdir as Fdir } from 'fdir';
import path from 'node:path';
import fsp from 'node:fs/promises';
import { SOURCE_DIR } from './constants/dir';
import { readFileByLine } from './lib/fetch-text-by-line';
import { processLine } from './lib/process-line';
import { HostnameSmolTrie } from 'hntrie/smol';
import { task } from './trace';
import { fastStringArrayJoin } from 'foxts/fast-string-array-join';

const ENFORCED_WHITELIST = [
  'hola.sk',
  'hola.org',
  'hola-shopping.com',
  'mynextphone.io',
  'iadmatapk.nosdn.127.net',
  'httpdns.bilivideo.com',
  'httpdns-v6.gslb.yy.com',
  'twemoji.maxcdn.com',
  'samsungcloudsolution.com',
  'samsungcloudsolution.net',
  'samsungqbe.com',
  'vocadb-analytics.fly.dev'
];

const DEDUPE_LIST: string[] = ['adx-static.ksosoft.com', 'dns.iqiyi.com', 'domain.expiring-soon.xyz', 'img.catwvod.xyz', 'img.vim-cn.com', 's3-zen.mds.yandex.net'];

task(require.main === module, __filename)(async (span) => {
  const files = await span.traceChildAsync('crawl thru all files', () => new Fdir()
    .withFullPaths()
    .filter((filepath, isDirectory) => {
      if (isDirectory) return true;

      const extname = path.extname(filepath);

      return extname !== '.js' && extname !== '.ts';
    })
    .crawl(SOURCE_DIR)
    .withPromise());

  const whiteTrie = span.traceChildSync('build whitelist trie', () => {
    const trie = new HostnameSmolTrie(DEDUPE_LIST);
    ENFORCED_WHITELIST.forEach((item) => trie.whitelist(item));
    return trie;
  });

  await Promise.all(files.map(file => span.traceChildAsync('dedupe ' + file, () => dedupeFile(file, whiteTrie))));
});

function trieHasEntry(trie: HostnameSmolTrie, line: string): boolean {
  if (line[0] === '.') return trie.hasSubdomain(line.slice(1));
  return trie.has(line) || trie.hasSubdomain(line);
}

function trieContains(trie: HostnameSmolTrie, line: string): boolean {
  return trie.match(line);
}

async function dedupeFile(file: string, whitelist: HostnameSmolTrie) {
  const result: string[] = [];

  const trie = new HostnameSmolTrie();

  let line: string | null = '';

  let trieCheck = trieHasEntry;

  for await (const l of readFileByLine(file)) {
    line = processLine(l);

    if (!line) {
      if (l.startsWith('# $ skip_dedupe_src')) {
        return;
      }
      if (l.startsWith('# $ dedupe_use_trie_contains')) {
        trieCheck = trieContains;
      }

      result.push(l); // keep all comments and blank lines
      continue;
    }

    if (trieCheck(trie, line)) {
      continue; // drop duplicate
    }

    if (trieHasEntry(whitelist, line)) {
      continue; // drop whitelisted items
    }

    trie.add(line);
    result.push(line);
  }

  return fsp.writeFile(file, fastStringArrayJoin(result, '\n') + '\n');
}

// function isDomainSuffix(whiteItem: string, incomingItem: string) {
//   const whiteIncludeDomain = whiteItem[0] === '.';
//   whiteItem = whiteItem[0] === '.' ? whiteItem.slice(1) : whiteItem;

//   if (whiteItem === incomingItem) {
//     return true; // as long as exact match, we don't care if subdomain is included or not
//   }
//   if (whiteIncludeDomain) {
//     return incomingItem.endsWith('.' + whiteItem);
//   }
//   return false;
// }
