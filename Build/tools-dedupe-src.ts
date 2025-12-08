import { fdir as Fdir } from 'fdir';
import path from 'node:path';
import fsp from 'node:fs/promises';
import { SOURCE_DIR } from './constants/dir';
import { readFileByLine } from './lib/fetch-text-by-line';
import { processLine } from './lib/process-line';
import { HostnameSmolTrie } from './lib/trie';
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
  'samsungqbe.com',
  'ntp.api.bz',
  'cdn.tuk.dev',
  'vocadb-analytics.fly.dev',
  'img.vim-cn.com'
];

const WHITELIST: string[] = ['ntp.api.bz', 'httpdns.bilivideo.com', 'httpdns.platform.dbankcloud.cn', 'dns.iqiyi.com', 'dns.qiyipic.iqiyi.com', 'img.vim-cn.com', 'chat-content.beanfun.com', 'archive.mirror.ba', 'ctan.imsc.res.in', 'gnu.freemirror.org', 'probe.whatismyipaddress.com', 'sdkrec.tf.360.cn', 'iadmatapk.nosdn.127.net', 'gamecenter.iqiyi.com', 'tracking.klickthru.com', 'm.shilian168.cn', 'm.zdjgj.cn', 'gcpool.ddns.net', 'radpool.ddns.net', 's9.maxstream.org', 's10.maxstream.org', 's11.maxstream.org', 'statics.erothots.co', 'mcdn.tubi.tv'];

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

  const trie = new HostnameSmolTrie();

  let line: string | null = '';

  // eslint-disable-next-line @typescript-eslint/unbound-method -- .call
  let trieHasOrContains = HostnameSmolTrie.prototype.has;

  for await (const l of readFileByLine(file)) {
    line = processLine(l);

    if (!line) {
      if (l.startsWith('# $ skip_dedupe_src')) {
        return;
      }
      if (l.startsWith('# $ dedupe_use_trie_contains')) {
        // eslint-disable-next-line @typescript-eslint/unbound-method -- .call
        trieHasOrContains = HostnameSmolTrie.prototype.contains;
      }

      result.push(l); // keep all comments and blank lines
      continue;
    }

    if (trieHasOrContains.call(trie, line)) {
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
