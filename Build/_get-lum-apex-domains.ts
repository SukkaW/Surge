import { fetchRemoteTextByLine, readFileByLine } from './lib/fetch-text-by-line';
import tldts from 'tldts';
import { HostnameSmolTrie } from './lib/trie';
import path from 'node:path';
import { SOURCE_DIR } from './constants/dir';
import { processLine } from './lib/process-line';

(async () => {
  const lines1 = await Array.fromAsync(await fetchRemoteTextByLine('https://raw.githubusercontent.com/durablenapkin/block/master/luminati.txt', true));
  const lines2 = await Array.fromAsync(await fetchRemoteTextByLine('https://raw.githubusercontent.com/durablenapkin/block/master/tvstream.txt', true));

  const trie = new HostnameSmolTrie();

  lines1.forEach((line) => {
    const apexDomain = tldts.getDomain(line.slice(8));
    if (apexDomain) {
      trie.add(apexDomain);
    }
  });
  lines2.forEach((line) => {
    const apexDomain = tldts.getDomain(line.slice(8));
    if (apexDomain) {
      trie.add(apexDomain);
    }
  });

  for await (const line of readFileByLine(path.join(SOURCE_DIR, 'domainset', 'reject.conf'))) {
    const l = processLine(line);
    if (l) {
      trie.whitelist(l);
    }
  }

  console.log(trie.dump().join('\n'));
})();
