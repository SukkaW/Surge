import { fdir as Fdir } from 'fdir';
import path from 'node:path';
import fsp from 'node:fs/promises';
import { SOURCE_DIR } from './constants/dir';
import { readFileByLine } from './lib/fetch-text-by-line';
import { processLine } from './lib/process-line';

const ENFORCED_WHITELIST = [
  'hola.sk',
  'hola.org',
  'iadmatapk.nosdn.127.net',
  'httpdns.bilivideo.com',
  'httpdns-v6.gslb.yy.com',
  'twemoji.maxcdn.com',
  'samsungcloudsolution.com',
  'samsungcloudsolution.net',
  'samsungqbe.com'
];

const WHITELIST: string[] = ['ton.local.twitter.com', 'prod.msocdn.com', 'twemoji.maxcdn.com', 'img.urlnode.com', 'ipfsgate.com', 'googleplay.pro', 'iadmatapk.nosdn.127.net', 'hola-shopping.com', 'brdtest.co', 'mynextphone.io', 'hola.hk', 'holashop.org', 'hola.sk', 'hola.com.sg', 'c.medialytics.com', 'adstats.mgc-games.com', 'search.mgc-games.com', 'kissdoujin.com', 'newminersage.com', 'trossmining.de', 'hashncash.net', 'microsolt.ru', 'moneropool.ru', 'hashforcash.us', 'bitcoinn.biz', 'webmining.co', 'lamba.top', 'httpdns.bilivideo.com', 'httpdns-v6.gslb.yy.com', 'k-cdn.depot.dev', 'li-cdn.com'];
(async () => {
  const files = await new Fdir()
    .withFullPaths()
    .filter((filepath, isDirectory) => {
      if (isDirectory) return true;

      const extname = path.extname(filepath);

      return extname !== '.js' && extname !== '.ts';
    })
    .crawl(SOURCE_DIR)
    .withPromise();

  const whitelist = WHITELIST.filter((item) => ENFORCED_WHITELIST.every((whitelistItem) => !isDomainSuffix(whitelistItem, item)));

  await Promise.all(files.map(file => dedupeFile(file, whitelist)));
})();

async function dedupeFile(file: string, whitelist: string[]) {
  const set = new Set<string>();
  const result: string[] = [];

  for await (const l of readFileByLine(file)) {
    const line = processLine(l);
    if (!line) {
      if (l.startsWith('# $ skip_dedupe_src')) {
        return;
      }

      result.push(l);
      continue;
    }

    if (set.has(line)) {
      continue;
    }

    // We can't use a trie here since we need to keep the order
    if (whitelist.some((item) => isDomainSuffix(item, line))) {
      continue;
    }

    set.add(line);
    result.push(line);
  }

  return fsp.writeFile(file, result.join('\n') + '\n');
}

function isDomainSuffix(suffixRule: string, domain: string) {
  if (suffixRule.length > domain.length + 1) {
    return false;
  }

  return suffixRule === domain || domain.endsWith('.' + suffixRule);
}
