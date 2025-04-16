import { fdir as Fdir } from 'fdir';
import path from 'node:path';
import fsp from 'node:fs/promises';
import { SOURCE_DIR } from './constants/dir';
import { readFileByLine } from './lib/fetch-text-by-line';

const WHITELIST: string[] = ['packages.argotunnel.com', 'compass-ssl.xbox.com', 'static.agilebits.com', 'ntp.api.bz', 'softwareupdate.vmware.com', 'ftp.apache.org', 'ftp.cuhk.edu.hk', 'apache.belnet.be', 'mirrors.viethosting.com', 'apache.01link.hk', 'artfiles.org.org', 'mirror.synyx.de', 'apache.mediamirrors.org', 'wwwftp.ciril.fr', 'mirror.dkd.de', 'apache.javapipe.com', 'ftp.heikorichter.name', 'apache.panu.it', 'mirrors.supportex.net', 'apache.forsale.plus', 'apache.spinellicreations.com', 'ftp.itu.edu.tr', 'mirror1.spango.com', 'apache.oshte.net', 'mirrors.koehn.com', 'apache.dattatec.com', 'download.nextag.com', 'mirror.jre655.com', 'mirror.kiu.ac.ug', 'apache.cp.if.ua', 'mirrors.sorengard.com', 'ftp.igh.cnrs.fr', 'mirrors.hostingromania.ro', 'mirror.bhoovd.com', 'download.xs4all.nl', 'cpan.panu.it', 'cpan.nctu.edu.tw', 'mirror.serverbeheren.nl', 'cpan.llarian.net', 'cpan.etla.org', 'mirrors.syringanetworks.net', 'mirror.met.hu', 'cpan.cs.uu.nl', 'mirror.teklinks.com', 'mirror.rasanegar.com', 'ctan.kako-dev.de', 'ctan.ijs.si', 'mirrors.chevalier.io', 'mirror.yongbok.net', '1-mirrors.in.sahilister.net', '2-mirrors.in.sahilister.net', 'cc.uoc.gr', 'mirror.sergal.org', 'mirrors.mi.ras.ru', 'ctan.cs.uu.nl', 'mirrors.tripadvisor.com', 'gnu.spinellicreations.com', 'ftp.neowiz.com', 'mirror.rackdc.com', 'mirror.veriportal.com', 'ftp.pbone.net', 'downloader.cursor.sh', 'redrockdigimark.commirror', 'nimiq.by', 'aaxdetect.com', 'ctan.epst-tlemcen.dz', 'udahce.com', 'rs-staticart.ybcdn.net', 'doumpaq.com', 'c.medialytics.com', 'keybut.com', 'adserver.ubiyoo.com', 'kaspa-classic.com', 'minafacil.com', 'jiandanpool.com', 'xn--blockchan-n5a.com', 'alphax.pro', 'crypto-pool.online', 'bbqpool.org', 'nyxcoin.org', 'lpool.name', 'tsfpool.xyz', 'ltcmaster.xyz', '8282.space', 'myminingpool.uk', 'binance.live', 'mining.garden', 'scaleway.ovh', 'atpool.party', 'nimiq.by', 'binance.directory', 'onyx.run', 'lucky-pool.co.uk', 'ra7.xyz'];

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

  await Promise.all(files.map(dedupeFile));
})();

async function dedupeFile(file: string) {
  const set = new Set<string>();
  const result: string[] = [];

  for await (const line of readFileByLine(file)) {
    if (line.length === 0) {
      result.push(line);
      continue;
    }
    if (line[0] === '#') {
      result.push(line);
      continue;
    }
    if (set.has(line)) {
      continue;
    }

    // We can't use a trie here since we need to keep the order
    if (WHITELIST.some((item) => {
      if (item.length > line.length) {
        return false;
      }

      return (
        item === line // exact match
        || line.endsWith('.' + item) // the whitelist is considered as a domain-suffix
      );
    })) {
      continue;
    }

    set.add(line);
    result.push(line);
  }

  return fsp.writeFile(file, result.join('\n') + '\n');
}
