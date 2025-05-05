/* eslint-disable unused-imports/no-unused-vars -- some unused methods */
import path from 'node:path';
import { processFilterRulesWithPreload } from './lib/parse-filter/filters';
import { processHosts } from './lib/parse-filter/hosts';
import { HostnameSmolTrie } from './lib/trie';
import { dummySpan } from './trace';
import { SOURCE_DIR } from './constants/dir';
import { PREDEFINED_WHITELIST } from './constants/reject-data-source';
import runAgainstSourceFile from './lib/run-against-source-file';

(async () => {
  const trie = new HostnameSmolTrie();

  // await writeHostsToTrie(trie, 'https://cdn.jsdelivr.net/gh/jerryn70/GoodbyeAds@master/Extension/GoodbyeAds-Xiaomi-Extension.txt', true);
  const { whiteDomainSuffixes, whiteDomains } = await writeFiltersToTrie(trie, 'https://cdn.jsdelivr.net/gh/Perflyst/PiHoleBlocklist@master/SmartTV-AGH.txt', true);

  const callback = (domain: string, includeAllSubDomain: boolean) => {
    trie.whitelist(domain, includeAllSubDomain);
  };

  await runAgainstSourceFile(path.join(SOURCE_DIR, 'domainset', 'reject.conf'), callback, 'domainset');
  await runAgainstSourceFile(path.join(SOURCE_DIR, 'non_ip', 'reject.conf'), callback, 'ruleset');

  for (let i = 0, len = PREDEFINED_WHITELIST.length; i < len; i++) {
    trie.whitelist(PREDEFINED_WHITELIST[i]);
  }

  console.log('---------------------------');
  console.log(trie.dump().join('\n'));
  console.log('---------------------------');
  console.log('whitelist domain suffixes:');
  console.log(whiteDomainSuffixes.join('\n'));
  console.log('---------------------------');
  console.log('whitelist domains:');
  console.log(whiteDomains.join('\n'));
})();

async function writeHostsToTrie(trie: HostnameSmolTrie, hostsUrl: string, includeAllSubDomain = false) {
  const hosts = await processHosts(dummySpan, hostsUrl, [], includeAllSubDomain);

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

  return { whiteDomainSuffixes, whiteDomains };
}
