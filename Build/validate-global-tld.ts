import path from 'node:path';
import { HostnameSmolTrie } from './lib/trie';
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

  await runAgainstSourceFile(path.join(OUTPUT_SURGE_DIR, 'non_ip', 'global.conf'), (domain, includeAllSubDomain) => {
    trie.add(domain, includeAllSubDomain);
  }, 'ruleset');

  ICP_TLD.forEach(tld => trie.whitelist(tld, true));
  extraWhiteTLDs.forEach(tld => trie.whitelist(tld, true));

  console.log(trie.dump().join('\n'));
})();
