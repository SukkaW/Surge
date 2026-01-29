import path from 'node:path';
import { SOURCE_DIR } from './constants/dir';
import { parseFelixDnsmasqFromResp } from './lib/parse-dnsmasq';
import { $$fetch } from './lib/fetch-retry';
import runAgainstSourceFile from './lib/run-against-source-file';
import { getTopOneMillionDomains } from './validate-gfwlist';
import { HostnameSmolTrie } from './lib/trie';
import tldts from 'tldts-experimental';
import { DOMESTICS } from '../Source/non_ip/domestic';

export async function parseDomesticList() {
  const allChinaDomains = new Set<string>(await parseFelixDnsmasqFromResp(await $$fetch('https://raw.githubusercontent.com/felixonmars/dnsmasq-china-list/master/accelerated-domains.china.conf')));

  const topDomainTrie = await getTopOneMillionDomains();

  const resultTrie = new HostnameSmolTrie();

  topDomainTrie.dumpWithoutDot((domain) => {
    const apexDomain = tldts.getDomain(domain);

    if (apexDomain && allChinaDomains.has(apexDomain)) {
      resultTrie.add(apexDomain, false);
    }
  });

  const callback = (domain: string, includeAllSubdomain: boolean) => resultTrie.whitelist(domain, includeAllSubdomain);

  // await Promise.all([
  await runAgainstSourceFile(
    path.resolve(SOURCE_DIR, 'non_ip/domestic.conf'),
    callback
  );
  await runAgainstSourceFile(
    path.resolve(SOURCE_DIR, 'domainset/reject.conf'),
    callback
  );

  Object.values(DOMESTICS).forEach(domestic => {
    domestic.domains.forEach(domain => {
      switch (domain[0]) {
        case '+':
        case '$': {
          resultTrie.whitelist(domain.slice(1), true);
          break;
        }
        default: {
          resultTrie.whitelist(domain, true);
          break;
        }
      }
    });
  });

  // noop, DOMAIN-KEYWORD handing
  // for (const d of top5000) {
  //   if (d.includes(domain)) {
  //     notIncludedDomestic.delete(d);
  //   }
  // }
  // ]);
  const dump = resultTrie.dump(null, true);

  console.log(dump.join('\n') + '\n');

  console.log(`# Total: ${dump.length}`);
}

if (require.main === module) {
  parseDomesticList().catch(console.error);
}
