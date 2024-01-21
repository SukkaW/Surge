import path from 'path';
import { traceAsync } from './lib/trace-runner';
import { task } from './trace';
import { createRuleset } from './lib/create-file';
import { fetchRemoteTextByLine } from './lib/fetch-text-by-line';
import { createTrie } from './lib/trie';
import { SHARED_DESCRIPTION } from './lib/constants';
import { createMemoizedPromise } from './lib/memo-promise';

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
  const set = await traceAsync('fetch accelerated-domains.china.conf', async () => {
    // First trie is to find the microsoft domains that matches probe domains
    const trie = createTrie();
    for await (const line of await fetchRemoteTextByLine('https://raw.githubusercontent.com/felixonmars/dnsmasq-china-list/master/accelerated-domains.china.conf')) {
      if (line.startsWith('server=/') && line.endsWith('/114.114.114.114')) {
        const domain = line.slice(8, -16);
        trie.add(domain);
      }
    }
    return new Set(PROBE_DOMAINS.flatMap(domain => trie.find(domain, false)));
  });

  // Second trie is to remove blacklisted domains
  const trie2 = createTrie(set);
  const black = BLACKLIST.flatMap(domain => trie2.find(domain, true));
  for (let i = 0, len = black.length; i < len; i++) {
    set.delete(black[i]);
  }

  return Array.from(set).map(d => `DOMAIN-SUFFIX,${d}`).concat(WHITELIST);
});

export const buildMicrosoftCdn = task(import.meta.path, async (span) => {
  const description = [
    ...SHARED_DESCRIPTION,
    '',
    'This file contains Microsoft\'s domains using their China mainland CDN servers.',
    '',
    'Data from:',
    ' - https://github.com/felixonmars/dnsmasq-china-list'
  ];

  return createRuleset(
    span,
    'Sukka\'s Ruleset - Microsoft CDN',
    description,
    new Date(),
    await getMicrosoftCdnRulesetPromise(),
    'ruleset',
    path.resolve(import.meta.dir, '../List/non_ip/microsoft_cdn.conf'),
    path.resolve(import.meta.dir, '../Clash/non_ip/microsoft_cdn.txt')
  );
});

if (import.meta.main) {
  buildMicrosoftCdn();
}
