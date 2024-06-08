import path from 'path';
import { task } from './trace';
import { createRuleset } from './lib/create-file';
import { fetchRemoteTextByLine } from './lib/fetch-text-by-line';
import { createTrie } from './lib/trie';
import { SHARED_DESCRIPTION } from './lib/constants';
import { createMemoizedPromise } from './lib/memo-promise';
import { extractDomainsFromFelixDnsmasq } from './lib/parse-dnsmasq';
import { sortDomains } from './lib/stable-sort-domain';

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
  const trie = createTrie(null, true);
  for await (const line of await fetchRemoteTextByLine('https://raw.githubusercontent.com/felixonmars/dnsmasq-china-list/master/accelerated-domains.china.conf')) {
    const domain = extractDomainsFromFelixDnsmasq(line);
    if (domain) {
      trie.add(domain);
    }
  }
  const foundMicrosoftCdnDomains = PROBE_DOMAINS.flatMap(domain => trie.find(domain));

  // Second trie is to remove blacklisted domains
  const trie2 = createTrie(foundMicrosoftCdnDomains, true, true);
  BLACKLIST.forEach(trie2.whitelist);

  return sortDomains(trie2.dump())
    .map(d => `DOMAIN-SUFFIX,${d}`)
    .concat(WHITELIST);
});

export const buildMicrosoftCdn = task(import.meta.main, import.meta.path)(async (span) => {
  const description = [
    ...SHARED_DESCRIPTION,
    '',
    'This file contains Microsoft\'s domains using their China mainland CDN servers.',
    '',
    'Data from:',
    ' - https://github.com/felixonmars/dnsmasq-china-list'
  ];

  const res: string[] = await span.traceChildPromise('get microsoft cdn domains', getMicrosoftCdnRulesetPromise());

  return createRuleset(
    span,
    'Sukka\'s Ruleset - Microsoft CDN',
    description,
    new Date(),
    res,
    'ruleset',
    path.resolve(import.meta.dir, '../List/non_ip/microsoft_cdn.conf'),
    path.resolve(import.meta.dir, '../Clash/non_ip/microsoft_cdn.txt')
  );
});
