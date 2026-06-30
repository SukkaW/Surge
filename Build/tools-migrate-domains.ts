/* eslint-disable unused-imports/no-unused-vars -- some unused methods */
import path from 'node:path';
import { processFilterRulesWithPreload } from './lib/parse-filter/filters';
import { processHosts } from './lib/parse-filter/hosts';
import { HostnameSmolTrie } from 'hntrie/smol';
import { domainToASCII } from 'node:url';
import { dummySpan } from './trace';
import { SOURCE_DIR } from './constants/dir';
import { PREDEFINED_WHITELIST } from './constants/reject-data-source';
import runAgainstSourceFile from './lib/run-against-source-file';

(async () => {
  const trie = new HostnameSmolTrie();

  await writeHostsToTrie(trie, 'https://cdn.jsdelivr.net/gh/jerryn70/GoodbyeAds@master/Extension/GoodbyeAds-Xiaomi-Extension.txt', true);
  // const { whiteDomainSuffixes, whiteDomains } = await writeFiltersToTrie(trie, 'https://cdn.jsdelivr.net/gh/Perflyst/PiHoleBlocklist@master/SmartTV-AGH.txt', true);

  const callback = (domain: string, includeAllSubDomain: boolean) => {
    trie.whitelist(includeAllSubDomain ? '.' + domain : domain);
  };

  await runAgainstSourceFile(path.join(SOURCE_DIR, 'domainset', 'reject.conf'), callback, 'domainset');
  await runAgainstSourceFile(path.join(SOURCE_DIR, 'non_ip', 'reject.conf'), callback, 'ruleset');

  for (let i = 0, len = PREDEFINED_WHITELIST.length; i < len; i++) {
    trie.whitelist(PREDEFINED_WHITELIST[i]);
  }

  console.log('---------------------------');
  const dump: string[] = [];
  trie.dump((rawDomain, includeSubdomain) => {
    const domain = domainToASCII(rawDomain);
    if (domain) dump.push(includeSubdomain ? '.' + domain : domain);
  });
  console.log(dump.join('\n'));
  console.log('---------------------------');
  // console.log('whitelist domain suffixes:');
  // console.log(whiteDomainSuffixes.join('\n'));
  // console.log('---------------------------');
  // console.log('whitelist domains:');
  // console.log(whiteDomains.join('\n'));
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
    trie.addSubdomain(blackDomainSuffixes[i]);
  }
  for (let i = 0, len = blackDomains.length; i < len; i++) {
    trie.add(blackDomains[i]);
  }
  for (let i = 0, len = whiteDomainSuffixes.length; i < len; i++) {
    trie.whitelist('.' + whiteDomainSuffixes[i]);
  }
  for (let i = 0, len = whiteDomains.length; i < len; i++) {
    trie.whitelist(whiteDomains[i]);
  }

  return { whiteDomainSuffixes, whiteDomains };
}
