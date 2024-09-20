import { task } from './trace';
import { fetchRemoteTextByLine } from './lib/fetch-text-by-line';
import { createTrie } from './lib/trie';
import { SHARED_DESCRIPTION } from './lib/constants';
import { createMemoizedPromise } from './lib/memo-promise';
import { extractDomainsFromFelixDnsmasq } from './lib/parse-dnsmasq';
import { RulesetOutput } from './lib/create-file';

const PROBE_DOMAINS = ['.microsoft.com', '.windows.net', '.windows.com', '.windowsupdate.com', '.windowssearch.com', '.office.net'];

const WHITELIST = [
  'DOMAIN-SUFFIX,download.prss.microsoft.com',
  'DOMAIN,res.cdn.office.net'
];

const BLACKLIST = [
  'www.microsoft.com',
  'learn.microsoft.com',
  'devblogs.microsoft.com',
  'docs.microsoft.com',
  'developer.microsoft.com',
  'windowsupdate.com'
];

export const getMicrosoftCdnRulesetPromise = createMemoizedPromise(async () => {
  // First trie is to find the microsoft domains that matches probe domains
  const trie = createTrie(null, false);
  for await (const line of await fetchRemoteTextByLine('https://raw.githubusercontent.com/felixonmars/dnsmasq-china-list/master/accelerated-domains.china.conf')) {
    const domain = extractDomainsFromFelixDnsmasq(line);
    if (domain) {
      trie.add(domain);
    }
  }
  const foundMicrosoftCdnDomains = PROBE_DOMAINS.flatMap(domain => trie.find(domain));

  // Second trie is to remove blacklisted domains
  const trie2 = createTrie(foundMicrosoftCdnDomains, true);
  BLACKLIST.forEach(trie2.whitelist);

  return trie2.dump()
    .map(d => `DOMAIN-SUFFIX,${d}`)
    .concat(WHITELIST);
});

export const buildMicrosoftCdn = task(require.main === module, __filename)(async (span) => {
  const description = [
    ...SHARED_DESCRIPTION,
    '',
    'This file contains Microsoft\'s domains using their China mainland CDN servers.',
    '',
    'Data from:',
    ' - https://github.com/felixonmars/dnsmasq-china-list'
  ];

  const res: string[] = await span.traceChildPromise('get microsoft cdn domains', getMicrosoftCdnRulesetPromise());

  return new RulesetOutput(span, 'microsoft_cdn', 'non_ip')
    .withTitle('Sukka\'s Ruleset - Microsoft CDN')
    .withDescription(description)
    .addFromRuleset(res)
    .write();
});
