import path from 'node:path';
import { readFileByLine } from './lib/fetch-text-by-line';
import { HostnameSmolTrie } from './lib/trie';
import { OUTPUT_SURGE_DIR, SOURCE_DIR } from './constants/dir';
import { ICP_TLD } from './constants/domains';
import tldts from 'tldts-experimental';
import { looseTldtsOpt } from './constants/loose-tldts-opt';

(async () => {
  const trie = new HostnameSmolTrie();
  const extraWhiteTLDs = new Set<string>();

  for await (const line of readFileByLine(path.join(OUTPUT_SURGE_DIR, 'non_ip', 'domestic.conf'))) {
    const [type, domain] = line.split(',');
    if (type !== 'DOMAIN' && type !== 'DOMAIN-SUFFIX') {
      continue;
    }
    if (domain === 'this_ruleset_is_made_by_sukkaw.ruleset.skk.moe') {
      continue;
    }
    const tld = tldts.getPublicSuffix(domain, looseTldtsOpt);
    if (tld) {
      extraWhiteTLDs.add(tld);
    }
  }

  for await (const line of readFileByLine(path.join(SOURCE_DIR, 'non_ip', 'global.conf'))) {
    const [type, domain] = line.split(',');
    switch (type) {
      case 'DOMAIN':
        trie.add(domain);
        break;
      case 'DOMAIN-SUFFIX':
        trie.add(domain, true);
        break;
      default:
        break;
    }
  }

  ICP_TLD.forEach(tld => trie.whitelist(tld, true));
  extraWhiteTLDs.forEach(tld => trie.whitelist(tld, true));

  console.log(trie.dump().join('\n'));
})();
