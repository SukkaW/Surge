import { fdir as Fdir } from 'fdir';
import path from 'node:path';
import fsp from 'node:fs/promises';
import { SOURCE_DIR } from './constants/dir';
import { readFileByLine } from './lib/fetch-text-by-line';
import { processLine } from './lib/process-line';
import { HostnameSmolTrie } from './lib/trie';

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
  'samsungqbe.com'
];

const WHITELIST: string[] = ['.lightspeedmining.com', 'samsungqbe.com', '.zbeos.com', '.holashop.org', '.jdie.pl', '.sponsor.printondemandagency.com', '.bmcm.pw', '.vplay.life', '.hola.hk', '.peopleland.net', '.120bit.com', '.tekyboycrypto.xyz', '.rocketpool.pro', '.cryptoloot.pro', '.weminerpool.site', '.timg135.top', '.binance.associates', '.lafermedumineur.fr', '.goldencoin.online', '.hola.sk', '.hola.com.sg', '.acashtech.com', '.bitoreum.org', '.mixpools.org', '.decapool.net', '.taichicoin.org', '.luxxeeu.com'];

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

  const whiteTrie = new HostnameSmolTrie(WHITELIST);
  ENFORCED_WHITELIST.forEach((item) => whiteTrie.whitelist(item));
  const whitelist = whiteTrie.dump();

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
    if (whitelist.some((whiteItem) => isDomainSuffix(whiteItem, line))) {
      continue;
    }

    set.add(line);
    result.push(line);
  }

  return fsp.writeFile(file, result.join('\n') + '\n');
}

function isDomainSuffix(whiteItem: string, incomingItem: string) {
  const whiteIncludeDomain = whiteItem[0] === '.';
  whiteItem = whiteItem[0] === '.' ? whiteItem.slice(1) : whiteItem;

  if (whiteItem === incomingItem) {
    return true; // as long as exact match, we don't care if subdomain is included or not
  }
  if (whiteIncludeDomain) {
    return incomingItem.endsWith('.' + whiteItem);
  }
  return false;
}
