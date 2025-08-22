import { task } from './trace';
import { SHARED_DESCRIPTION } from './constants/description';
import { once } from 'foxts/once';
import { RulesetOutput } from './lib/rules/ruleset';
import Worktank from 'worktank';
import { RULES } from './constants/microsoft-cdn';

const pool = new Worktank({
  pool: {
    name: 'get-microsoft-cdn',
    size: 1 // The number of workers to keep in the pool, if more workers are needed they will be spawned up to this limit
  },
  worker: {
    autoAbort: 10000,
    autoTerminate: 30000, // The interval of milliseconds at which to check if the pool can be automatically terminated, to free up resources, workers will be spawned up again if needed
    autoInstantiate: true,
    methods: {
    // eslint-disable-next-line object-shorthand -- workertank
      getMicrosoftCdnRuleset: async function (importMetaUrl: string): Promise<[domains: string[], domainSuffixes: string[]]> {
        // TODO: createRequire is a temporary workaround for https://github.com/nodejs/node/issues/51956
        const { default: module } = await import('node:module');
        const __require = module.createRequire(importMetaUrl);

        const { HostnameSmolTrie } = __require('./lib/trie');
        const { PROBE_DOMAINS, DOMAINS, DOMAIN_SUFFIXES, BLACKLIST } = __require('./constants/microsoft-cdn') as typeof import('./constants/microsoft-cdn');
        const { fetchRemoteTextByLine } = __require('./lib/fetch-text-by-line') as typeof import('./lib/fetch-text-by-line');
        const { appendArrayInPlace } = __require('foxts/append-array-in-place') as typeof import('foxts/append-array-in-place');
        const { extractDomainsFromFelixDnsmasq } = __require('./lib/parse-dnsmasq') as typeof import('./lib/parse-dnsmasq');

        const trie = new HostnameSmolTrie();

        for await (const line of await fetchRemoteTextByLine('https://raw.githubusercontent.com/felixonmars/dnsmasq-china-list/master/accelerated-domains.china.conf')) {
          const domain = extractDomainsFromFelixDnsmasq(line);
          if (domain) {
            trie.add(domain);
          }
        }

        // remove blacklist domain from trie, to prevent them from being included in the later dump
        BLACKLIST.forEach(black => trie.whitelist(black));

        const domains: string[] = DOMAINS;
        const domainSuffixes = appendArrayInPlace(PROBE_DOMAINS.flatMap(domain => trie.find(domain)), DOMAIN_SUFFIXES);

        return [domains, domainSuffixes] as const;
      }
    }
  }
});

export const getMicrosoftCdnRulesetPromise = once<Promise<[domains: string[], domainSuffixes: string[]]>>(async () => {
  const res = await pool.exec(
    'getMicrosoftCdnRuleset',
    [import.meta.url]
  );
  pool.terminate();

  return res;
});

export const buildMicrosoftCdn = task(require.main === module, __filename)(async (span) => {
  const [domains, domainSuffixes] = await span.traceChildPromise('get microsoft cdn domains', getMicrosoftCdnRulesetPromise());

  return new RulesetOutput(span, 'microsoft_cdn', 'non_ip')
    .withTitle('Sukka\'s Ruleset - Microsoft CDN')
    .appendDescription(SHARED_DESCRIPTION)
    .appendDescription(
      '',
      'This file contains Microsoft\'s domains using their China mainland CDN servers.'
    )
    .addFromRuleset(RULES)
    .appendDataSource('https://github.com/felixonmars/dnsmasq-china-list')
    .bulkAddDomain(domains)
    .bulkAddDomainSuffix(domainSuffixes)
    .write();
});
