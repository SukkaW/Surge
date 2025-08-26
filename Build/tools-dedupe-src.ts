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
  'samsungqbe.com',
  'ntp.api.bz',
  'cdn.tuk.dev'
];

const WHITELIST: string[] = ['ntp.api.bz', 'httpdns-v6.gslb.yy.com', 'httpdns.bilivideo.com', 'cp3.cloudflare.com', 'filestore.community.support.microsoft.com', 'answers-afd.microsoft.com', 'cdns.us.gigya.com', 'cdnapisec.kaltura.com', 'wac-cdn-2.atlassian.com', 'r3.o.lencr.org', 'mastodon-static.miao.dev', 'media-s3-eu-west-1.ceros.com', 'media-s3-us-west-1.ceros.com', 'static.osdn.net', 'static-cdn.osdn.net', 'static.cracked.io', 'cdn.tuk.dev', 'cdn.apkmonk.com', 'static.cracked.to', 'ftp.panu.it', 'ftp.download-by.net', 'aus2-community.mozilla.org', 'apache.volia.net', 'httpupdate118.cpanel.net', 'httpupdate127.cpanel.net', 'cpan.perl.pt', 'mirrors.namecheap.com', 'analytics.nexon.com', 'advst.cp33.ott.cibntv.net', 't.l.qq.com', 'adsence.sogou.com', 'ads-jp.tiktok.com', 'tnc3-alisc2.zijieapi.com', 'adv.fjtv.net', 'd.cntv.cn', 'api.ad.yipinread.com', 'a.cntv.cn', 'norma-external-collect.meizu.com', 'app.starschina.com', 'ad.where.com', 'sanme2.taisantech.com', 'd37ju0xanoz6gh.cloudfront.net', 'd2tnx644ijgq6i.cloudfront.net', 'glores2.taisantech.com', 'd1jwpcr0q4pcq0.cloudfront.net', 'nimiq.terorie.com', 'iadmatapk.nosdn.127.net', 'poolvale.ddns.net', 'imperium.getmyip.com', 'egazpool.ddns.net', 'cryptominer.ddns.net', 'gustaver.ddns.net', 'scryptpool.ddns.net', 'hobbyistpool.ddns.net', 'mostbiznet.ddns.net', 'bowserpool.ddns.net', 'd1pool.ddns.net', 'kingsminer.ddnsking.com', 'cryptocoin.ddns.net', 'real-time-morning.000webhostapp.com', 'btcsq.ddns.net', 'thelifeisbinary.ddns.net', 'spiky-inclinations.000webhostapp.com', 'coinmining.ddns.net', 'xenafiter.000webhostapp.com', 'sperocoin.ddns.net', 'xerox300.000webhostapp.com', 'bowser777.ddns.net', 'julrina.000webhostapp.com', 'decart-oasis.azureedge.net', 'media1.kissjav.com', 'media4.kissjav.com', 's4.maxstream.org', 'media2.kissjav.com', 's5.maxstream.org', 'static4.muchohentai.com', 'static5.muchohentai.com', 'media7.kissjav.com', 'static2.muchohentai.com', 'media10.kissjav.com', 's6.maxstream.org', 'static1.muchohentai.com', 'media8.kissjav.com', 'halacostminer.000webhostapp.com', 's7.maxstream.org', 'media3.kissjav.com', 'media9.kissjav.com', 'static3.muchohentai.com', 'v2-images.crackle.com', 'sw.cool3c.com', 'ti2.knews.cc', 'cdn1.xxxsx.com', 'i.hkepc.com', 'images.mooncloud.top', 'ti1.knews.cc', 'file1.hkepc.com', 'vte-us.readspeaker.com'];

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
