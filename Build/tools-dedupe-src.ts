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

const DEDUPE_LIST: string[] = ['127.atlas.skk.moe', 'ntp.api.bz', 'httpdns.bilivideo.com', 'dns.qiyipic.iqiyi.com', 'cdn.graph.office.net', 'dns.iqiyi.com', 'img.vim-cn.com', 'image.westinyou.com', 'edge1.certona.net', 'certona.gap.com', 'yep.video.yahoo.com', 'static.opensea.io', 'shopify.cleverecommerce.com', 'tile.mapzen.com', 'cdn.cracked.sh', 'images.idgesg.net', 'drive.massgrave.dev', 'alt.idgesg.net', 'mirror.ghproxy.com', 'mirror.nl.datapacket.com', 'mirror.anigil.com', 'mirror.nus.edu.sg', 'mirror.timkevin.us', 'mirrors.nic.cz', 'cpan.tetaneutral.net', 'mirror.datapacket.com', 'client.hikarifield.co.jp', 'a.macked.app', 'apache.tt.co.kr', 'fm.p0y.cn', 'iyes.youku.com', 'ad.api.mobile.youku.com', 'c.yes.youku.com', 'ad.jamster.co.uk', 'fumiad.dxys.pro', 'ad.leadboltapps.net', 'ems.cp12.wasu.tv', 'creative1cdn.mobfox.com', 'mycommerce.akamaized.net', 'js-cdn.blockchair.io', 'loutre.blockchair.io', 'static.namebeta.com', 'fs2.onlyhentaistuff.com', 'file.izanmei.net', 'play.xiaoh.ai', 'file.xiaohai.ai', 'tiles.wmflabs.org', 'image.stheadline.com', 'vod.jfly.xyz', 'assets.wikiwand.com', 'cdn.wikiwand.com', 'cloudfront.codeproject.com', 'assets-cdn.anh.moe', 'media.d.tube', 'media.remax-prod.eng.remax.tech', 'static-landing.probiplacehold.cot.com'];
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
