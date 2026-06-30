import path from 'node:path';
import { HostnameSmolTrie } from 'hntrie/smol';
import { domainToASCII } from 'node:url';
import { OUTPUT_SURGE_DIR } from './constants/dir';
import { ICP_TLD } from './constants/domains';
import tldts from 'tldts-experimental';
import { looseTldtsOpt } from './constants/loose-tldts-opt';
import runAgainstSourceFile from './lib/run-against-source-file';
import { MARKER_DOMAIN } from './constants/description';

(async () => {
  const trie = new HostnameSmolTrie();
  const extraWhiteTLDs = new Set<string>();

  await runAgainstSourceFile(path.join(OUTPUT_SURGE_DIR, 'non_ip', 'domestic.conf'), (domain) => {
    if (domain === MARKER_DOMAIN) {
      return;
    }
    const tld = tldts.getPublicSuffix(domain, looseTldtsOpt);
    if (tld) {
      extraWhiteTLDs.add(tld);
    }
  }, 'ruleset');

  await runAgainstSourceFile(path.join(OUTPUT_SURGE_DIR, 'non_ip', 'global.conf'), (domain, includeAllSubdomain) => {
    if (includeAllSubdomain) {
      trie.addSubdomain(domain);
    } else {
      trie.add(domain);
    }
  }, 'ruleset');

  ICP_TLD.forEach(tld => trie.whitelist('.' + tld));
  extraWhiteTLDs.forEach(tld => trie.whitelist('.' + tld));

  const dump: string[] = [];
  trie.dump((rawDomain, includeSubdomain) => {
    const domain = domainToASCII(rawDomain);
    if (domain) dump.push(includeSubdomain ? '.' + domain : domain);
  });
  console.log(dump.join('\n'));
})();
