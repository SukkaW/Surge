import path from 'node:path';
import { SOURCE_DIR } from './constants/dir';
import { parseFelixDnsmasqFromResp } from './lib/parse-dnsmasq';
import { $$fetch } from './lib/fetch-retry';
import runAgainstSourceFile from './lib/run-against-source-file';
import { getTopOneMillionDomains } from './validate-gfwlist';
import { HostnameSmolTrie } from 'hntrie/smol';
import { domainToASCII } from 'node:url';
import tldts from 'tldts-experimental';
import { DOMESTICS } from '../Source/non_ip/domestic';

export async function parseDomesticList() {
  const allChinaDomains = new Set<string>(await parseFelixDnsmasqFromResp(await $$fetch('https://raw.githubusercontent.com/felixonmars/dnsmasq-china-list/master/accelerated-domains.china.conf')));

  const topDomainTrie = await getTopOneMillionDomains();

  const resultTrie = new HostnameSmolTrie();

  topDomainTrie.dump((domain) => {
    const apexDomain = tldts.getDomain(domain);

    if (apexDomain && allChinaDomains.has(apexDomain)) {
      resultTrie.add(apexDomain);
    }
  });

  const callback = (domain: string, includeAllSubdomain: boolean) => resultTrie.whitelist(includeAllSubdomain ? '.' + domain : domain);

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
          resultTrie.whitelist('.' + domain.slice(1));
          break;
        }
        default: {
          resultTrie.whitelist('.' + domain);
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
  const dump: string[] = [];
  resultTrie.dump((rawDomain, includeSubdomain) => {
    const domain = domainToASCII(rawDomain);
    if (domain) dump.push(includeSubdomain ? '.' + domain : domain);
  });
  dump.sort((a, b) => (a.length - b.length) || (a < b ? -1 : (a > b ? 1 : 0)));

  console.log(dump.join('\n') + '\n');

  console.log(`# Total: ${dump.length}`);
}

if (require.main === module) {
  parseDomesticList().catch(console.error);
}
