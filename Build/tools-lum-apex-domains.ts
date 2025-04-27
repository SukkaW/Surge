import { fetchRemoteTextByLine } from './lib/fetch-text-by-line';
import tldts from 'tldts';
import { HostnameSmolTrie } from './lib/trie';
import path from 'node:path';
import { SOURCE_DIR } from './constants/dir';
import runAgainstSourceFile from './lib/run-against-source-file';

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

  const dataFromDuckDuckGo = await fetch('https://raw.githubusercontent.com/duckduckgo/tracker-radar/92e086ce38a8a88c964ed0184e5277ec1d5c8038/entities/Bright%20Data%20Ltd..json').then((res) => res.json());
  if (typeof dataFromDuckDuckGo === 'object' && dataFromDuckDuckGo !== null && 'properties' in dataFromDuckDuckGo && Array.isArray(dataFromDuckDuckGo.properties)) {
    dataFromDuckDuckGo.properties.forEach((prop) => {
      trie.add(prop);
    });
  }

  await runAgainstSourceFile(path.join(SOURCE_DIR, 'domainset', 'reject.conf'), (domain, includeAllSubDomain) => {
    trie.whitelist(domain, includeAllSubDomain);
  }, 'domainset');
  await runAgainstSourceFile(path.join(SOURCE_DIR, 'non_ip', 'reject.conf'), (domain, includeAllSubDomain) => {
    trie.whitelist(domain, includeAllSubDomain);
  }, 'ruleset');

  console.log(trie.dump().map(i => '.' + i).join('\n'));
})();
