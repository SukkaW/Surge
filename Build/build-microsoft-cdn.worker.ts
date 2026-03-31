import { task } from './trace';
import { SHARED_DESCRIPTION } from './constants/description';
import { RulesetOutput } from './lib/rules/ruleset';
import { RULES, PROBE_DOMAINS, DOMAINS, DOMAIN_SUFFIXES, BLACKLIST } from './constants/microsoft-cdn';
import { HostnameSmolTrie } from './lib/trie';
import { fetchRemoteTextByLine } from './lib/fetch-text-by-line';
import { appendArrayInPlace } from 'foxts/append-array-in-place';
import { extractDomainsFromFelixDnsmasq } from './lib/parse-dnsmasq';

export const buildMicrosoftCdn = task(require.main === module, __filename)(async (span) => {
  const [domains, domainSuffixes] = await span.traceChildAsync('get microsoft cdn domains', async () => {
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

    return [domains, domainSuffixes] as [string[], string[]];
  });

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
