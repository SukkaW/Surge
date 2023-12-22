import path from 'path';
import { task, traceAsync } from './lib/trace-runner';
import { createRuleset } from './lib/create-file';
import { fetchRemoteTextByLine } from './lib/fetch-text-by-line';
import { createTrie } from './lib/trie';
import { SHARED_DESCRIPTION } from './lib/constants';
import { createMemoizedPromise } from './lib/memo-promise';

const WHITELIST = [
  'DOMAIN-SUFFIX,download.prss.microsoft.com',
  'DOMAIN,res.cdn.office.net'
];

const BLACKLIST = [
  'www.microsoft.com',
  'learn.microsoft.com',
  'devblogs.microsoft.com',
  'docs.microsoft.com',
  'developer.microsoft.com'
];

export const getMicrosoftCdnRulesetPromise = createMemoizedPromise(async () => {
  const set = await traceAsync('fetch accelerated-domains.china.conf', async () => {
    const trie = createTrie();
    for await (const line of await fetchRemoteTextByLine('https://raw.githubusercontent.com/felixonmars/dnsmasq-china-list/master/accelerated-domains.china.conf')) {
      if (line.startsWith('server=/') && line.endsWith('/114.114.114.114')) {
        const domain = line.slice(8, -16);
        trie.add(domain);
      }
    }
    return new Set(['.microsoft.com', '.windows.net', '.windows.com', '.windowsupdate.com', '.windowssearch.com', '.office.net'].flatMap(domain => trie.find(domain, false)));
  });

  const trie2 = createTrie(set);
  BLACKLIST.flatMap(domain => trie2.find(domain, true)).forEach(d => set.delete(d));

  return Array.from(set).map(d => `DOMAIN-SUFFIX,${d}`).concat(WHITELIST);
});

export const buildMicrosoftCdn = task(import.meta.path, async () => {
  const description = [
    ...SHARED_DESCRIPTION,
    '',
    'This file contains Microsoft\'s domains using their China mainland CDN servers.',
    '',
    'Data from:',
    ' - https://github.com/felixonmars/dnsmasq-china-list'
  ];

  return Promise.all(createRuleset(
    'Sukka\'s Ruleset - Microsoft CDN',
    description,
    new Date(),
    await getMicrosoftCdnRulesetPromise(),
    'ruleset',
    path.resolve(import.meta.dir, '../List/non_ip/microsoft_cdn.conf'),
    path.resolve(import.meta.dir, '../Clash/non_ip/microsoft_cdn.txt')
  ));
});

if (import.meta.main) {
  buildMicrosoftCdn();
}
