import path from 'node:path';
import { readFileByLine } from './lib/fetch-text-by-line';
import { processFilterRulesWithPreload } from './lib/parse-filter/filters';
import { processHosts } from './lib/parse-filter/hosts';
import { processLine } from './lib/process-line';
import { HostnameSmolTrie } from './lib/trie';
import { dummySpan } from './trace';
import { SOURCE_DIR } from './constants/dir';

(async () => {
  const trie = new HostnameSmolTrie();

  writeFiltersToTrie(trie, 'https://cdn.jsdelivr.net/gh/DandelionSprout/adfilt@master/GameConsoleAdblockList.txt', true);

  for await (const line of readFileByLine(path.join(SOURCE_DIR, 'domainset', 'reject.conf'))) {
    const l = processLine(line);
    if (l) {
      trie.whitelist(l);
    }
  }

  console.log('---------------------------');
  console.log(trie.dump().join('\n'));
  console.log('---------------------------');
})();

// eslint-disable-next-line unused-imports/no-unused-vars -- ready to use function
async function writeHostsToTrie(trie: HostnameSmolTrie, hostsUrl: string, includeAllSubDomain = false) {
  const hosts = await processHosts(dummySpan, 'https://cdn.jsdelivr.net/gh/DandelionSprout/adfilt@master/GameConsoleAdblockList.txt', [], includeAllSubDomain);

  for (let i = 0, len = hosts.length; i < len; i++) {
    trie.add(hosts[i]);
  }
}

async function writeFiltersToTrie(trie: HostnameSmolTrie, filterUrl: string, includeThirdParty = false) {
  const { whiteDomainSuffixes, whiteDomains, blackDomainSuffixes, blackDomains } = await processFilterRulesWithPreload(filterUrl, [], includeThirdParty)(dummySpan);
  for (let i = 0, len = blackDomainSuffixes.length; i < len; i++) {
    trie.add(blackDomainSuffixes[i], true);
  }
  for (let i = 0, len = blackDomains.length; i < len; i++) {
    trie.add(blackDomains[i], false);
  }
  for (let i = 0, len = whiteDomainSuffixes.length; i < len; i++) {
    trie.whitelist(whiteDomainSuffixes[i], true);
  }
  for (let i = 0, len = whiteDomains.length; i < len; i++) {
    trie.whitelist(whiteDomains[i], false);
  }
}
