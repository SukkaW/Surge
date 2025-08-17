import { fdir as Fdir } from 'fdir';
import path from 'node:path';
import fsp from 'node:fs/promises';
import { SOURCE_DIR } from './constants/dir';
import { readFileByLine } from './lib/fetch-text-by-line';
import { processLine } from './lib/process-line';
import { HostnameSmolTrie, HostnameTrie } from './lib/trie';
import { task } from './trace';

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

const WHITELIST: string[] = ['.dxdhd.com', '.tokto-motion.net', '.hola-shopping.com', '.luxxeeu.com', '.newzgames.com', '.hola.com.sg', 'pengtu.cc', '.cdn-js-query.com', 'samsungcloudsolution.net', 'samsungcloudsolution.com', 'static.estebull.com', '.drawservant.com', '.enjoy7plains.xyz', '.zmfindyourhalf.top', '.mineblocks.eu', '.cointaft.com', '.chain-pool.com', '.lamby-crypto.com', '.grftpool.com', '.onebtcplace.com', '.pepecore.com', '.punchsub.net', '.imzlabs.net', '.datapaw.net', '.smpool.net', '.yetimining.net', '.igrid.org', '.50centfreedom.us', '.cyg2016.xyz', '.easypool.xyz', '.arhash.xyz', '.enviromint.xyz', '.pool.space', '.anomp.cc', '.bitconnectpool.co', '.cryptopool.space', '.automatix.to', '.coolmine.to', '.coolpool.to', '.dpool.to', '.template-download.to', '.aurum7.to', '.sunpool.to', '.speedpool.to', '.cfcnet.to', '.pool.do', '.pool.bit34.com', '.eos.zhizhu.to', '.mubicdn.com', 'cdn.fastmediaing.com', '.webinfcdn.com', '.aosikaimage.com'];

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
    const trie = new HostnameSmolTrie(WHITELIST);
    ENFORCED_WHITELIST.forEach((item) => trie.whitelist(item));
    return trie;
  });

  await Promise.all(files.map(file => span.traceChildAsync('dedupe ' + file, () => dedupeFile(file, whiteTrie))));
});

async function dedupeFile(file: string, whitelist: HostnameSmolTrie) {
  const result: string[] = [];

  const trie = new HostnameTrie();

  let line: string | null = '';

  for await (const l of readFileByLine(file)) {
    line = processLine(l);

    if (!line) {
      if (l.startsWith('# $ skip_dedupe_src')) {
        return;
      }

      result.push(l); // keep all comments and blank lines
      continue;
    }

    if (trie.has(line)) {
      continue; // drop duplicate
    }

    if (whitelist.has(line)) {
      continue; // drop whitelisted items
    }

    trie.add(line);
    result.push(line);
  }

  return fsp.writeFile(file, result.join('\n') + '\n');
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
