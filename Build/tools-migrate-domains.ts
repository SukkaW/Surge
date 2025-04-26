import path from 'node:path';
import { readFileByLine } from './lib/fetch-text-by-line';
import { processFilterRulesWithPreload } from './lib/parse-filter/filters';
import { processHosts } from './lib/parse-filter/hosts';
import { processLine } from './lib/process-line';
import { HostnameSmolTrie } from './lib/trie';
import { dummySpan } from './trace';
import { SOURCE_DIR } from './constants/dir';
import { PREDEFINED_WHITELIST } from './constants/reject-data-source';

(async () => {
  const trie = new HostnameSmolTrie();

  await writeHostsToTrie(trie, 'https://cdn.jsdelivr.net/gh/jerryn70/GoodbyeAds@master/Extension/GoodbyeAds-Xiaomi-Extension.txt', true);

  await runWhiteOnSource(path.join(SOURCE_DIR, 'domainset', 'reject.conf'), trie);

  for (let i = 0, len = PREDEFINED_WHITELIST.length; i < len; i++) {
    trie.whitelist(PREDEFINED_WHITELIST[i]);
  }

  console.log('---------------------------');
  console.log(trie.dump().join('\n'));
  console.log('---------------------------');
})();

async function runWhiteOnSource(sourceFile: string, trie: HostnameSmolTrie) {
  for await (const line of readFileByLine(sourceFile)) {
    const l = processLine(line);
    if (l) {
      trie.whitelist(l);
    }
  }
}

async function writeHostsToTrie(trie: HostnameSmolTrie, hostsUrl: string, includeAllSubDomain = false) {
  const hosts = await processHosts(dummySpan, hostsUrl, [], includeAllSubDomain);

  for (let i = 0, len = hosts.length; i < len; i++) {
    trie.add(hosts[i]);
  }
}

// eslint-disable-next-line unused-imports/no-unused-vars -- ready to use function
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
