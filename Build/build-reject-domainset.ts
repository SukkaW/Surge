// @ts-check
import path from 'path';

import { processHosts, processFilterRules, processDomainLists } from './lib/parse-filter';
import { createTrie } from './lib/trie';

import { HOSTS, ADGUARD_FILTERS, PREDEFINED_WHITELIST, DOMAIN_LISTS, HOSTS_EXTRA, DOMAIN_LISTS_EXTRA, ADGUARD_FILTERS_EXTRA, PHISHING_DOMAIN_LISTS_EXTRA } from './constants/reject-data-source';
import { createRuleset, compareAndWriteFile } from './lib/create-file';
import { domainDeduper } from './lib/domain-deduper';
import createKeywordFilter from './lib/aho-corasick';
import { readFileByLine, readFileIntoProcessedArray } from './lib/fetch-text-by-line';
import { buildParseDomainMap, sortDomains } from './lib/stable-sort-domain';
import { task } from './trace';
// tldts-experimental is way faster than tldts, but very little bit inaccurate
// (since it is hashes based). But the result is still deterministic, which is
// enough when creating a simple stat of reject hosts.
import { SHARED_DESCRIPTION } from './lib/constants';
import { getPhishingDomains } from './lib/get-phishing-domains';

import { setAddFromArray, setAddFromArrayCurried } from './lib/set-add-from-array';

const getRejectSukkaConfPromise = readFileIntoProcessedArray(path.resolve(__dirname, '../Source/domainset/reject_sukka.conf'));

export const buildRejectDomainSet = task(require.main === module, __filename)(async (span) => {
  /** Whitelists */
  const filterRuleWhitelistDomainSets = new Set(PREDEFINED_WHITELIST);

  const domainSets = new Set<string>();
  const appendArrayToDomainSets = setAddFromArrayCurried(domainSets);

  const domainSetsExtra = new Set<string>();
  const appendArrayToDomainSetsExtra = setAddFromArrayCurried(domainSetsExtra);

  // Parse from AdGuard Filters
  const shouldStop = await span
    .traceChild('download and process hosts / adblock filter rules')
    .traceAsyncFn(async (childSpan) => {
      // eslint-disable-next-line sukka/no-single-return -- not single return
      let shouldStop = false;
      await Promise.all([
        // Parse from remote hosts & domain lists
        HOSTS.map(entry => processHosts(childSpan, ...entry).then(appendArrayToDomainSets)),
        HOSTS_EXTRA.map(entry => processHosts(childSpan, ...entry).then(appendArrayToDomainSetsExtra)),

        DOMAIN_LISTS.map(entry => processDomainLists(childSpan, ...entry).then(appendArrayToDomainSets)),
        DOMAIN_LISTS_EXTRA.map(entry => processDomainLists(childSpan, ...entry).then(appendArrayToDomainSetsExtra)),

        ADGUARD_FILTERS.map(
          input => processFilterRules(childSpan, ...input)
            .then(({ white, black, foundDebugDomain }) => {
              if (foundDebugDomain) {
                // eslint-disable-next-line sukka/no-single-return -- not single return
                shouldStop = true;
                // we should not break here, as we want to see full matches from all data source
              }
              setAddFromArray(filterRuleWhitelistDomainSets, white);
              setAddFromArray(domainSets, black);
            })
        ),
        ADGUARD_FILTERS_EXTRA.map(
          input => processFilterRules(childSpan, ...input)
            .then(({ white, black, foundDebugDomain }) => {
              if (foundDebugDomain) {
                // eslint-disable-next-line sukka/no-single-return -- not single return
                shouldStop = true;
                // we should not break here, as we want to see full matches from all data source
              }
              setAddFromArray(filterRuleWhitelistDomainSets, white);
              setAddFromArray(domainSetsExtra, black);
            })
        ),

        ([
          'https://raw.githubusercontent.com/AdguardTeam/AdGuardSDNSFilter/master/Filters/exceptions.txt',
          'https://raw.githubusercontent.com/AdguardTeam/AdGuardSDNSFilter/master/Filters/exclusions.txt'
        ].map(
          input => processFilterRules(childSpan, input).then(({ white, black }) => {
            setAddFromArray(filterRuleWhitelistDomainSets, white);
            setAddFromArray(filterRuleWhitelistDomainSets, black);
          })
        )),
        getPhishingDomains(childSpan).then(appendArrayToDomainSetsExtra),
        getRejectSukkaConfPromise.then(appendArrayToDomainSets)
      ].flat());
      // eslint-disable-next-line sukka/no-single-return -- not single return
      return shouldStop;
    });

  if (shouldStop) {
    process.exit(1);
  }

  console.log(`Import ${domainSets.size} + ${domainSetsExtra.size} rules from Hosts / AdBlock Filter Rules & reject_sukka.conf!`);

  // Dedupe domainSets
  const domainKeywordsSet = await span.traceChildAsync('collect black keywords/suffixes', async () => {
    /** Collect DOMAIN-KEYWORD from non_ip/reject.conf for deduplication */
    const domainKeywordsSet = new Set<string>();

    for await (const line of readFileByLine(path.resolve(__dirname, '../Source/non_ip/reject.conf'))) {
      const [type, value] = line.split(',');

      if (type === 'DOMAIN-KEYWORD') {
        domainKeywordsSet.add(value);
      } else if (type === 'DOMAIN-SUFFIX') {
        domainSets.add('.' + value); // Add to domainSets for later deduplication
      }
    }

    return domainKeywordsSet;
  });

  const [baseTrie, extraTrie] = span.traceChildSync('create smol trie while deduping black keywords', (childSpan) => {
    const baseTrie = createTrie(null, true, true);
    const extraTrie = createTrie(null, true, true);

    const kwfilter = createKeywordFilter(domainKeywordsSet);

    childSpan.traceChildSync('add items to trie (extra)', () => {
      for (const domain of domainSetsExtra) {
        // exclude keyword when creating trie
        if (!kwfilter(domain)) {
          extraTrie.add(domain);
        }
      }
    });

    childSpan.traceChildSync('add items to trie (base) + dedupe extra trie', () => {
      for (const domain of domainSets) {
        // exclude keyword when creating trie
        if (!kwfilter(domain)) {
          baseTrie.add(domain);

          extraTrie.whitelist(domain);
        }
      }
    });

    return [baseTrie, extraTrie] as const;
  });

  span.traceChildSync('dedupe from white suffixes (base)', () => filterRuleWhitelistDomainSets.forEach(baseTrie.whitelist));
  span.traceChildSync('dedupe from white suffixes and base (extra)', () => {
    filterRuleWhitelistDomainSets.forEach(extraTrie.whitelist);
  });

  // Dedupe domainSets
  const dudupedDominArray = span.traceChildSync('dedupe from covered subdomain (base)', () => domainDeduper(baseTrie));
  const dudupedDominArrayExtra = span.traceChildSync('dedupe from covered subdomain (extra)', () => domainDeduper(extraTrie));

  console.log(`Final size ${dudupedDominArray.length} + ${dudupedDominArrayExtra.length}`);

  const {
    domainMap: domainArrayMainDomainMap,
    subdomainMap: domainArraySubdomainMap
  } = span.traceChildSync(
    'build map for stat and sort',
    () => buildParseDomainMap(dudupedDominArray.concat(dudupedDominArrayExtra))
  );

  // Create reject stats
  const rejectDomainsStats: Array<[string, number]> = span
    .traceChild('create reject stats')
    .traceSyncFn(() => {
      const statMap = dudupedDominArray.reduce<Map<string, number>>((acc, cur) => {
        const suffix = domainArrayMainDomainMap.get(cur);
        if (suffix) {
          acc.set(suffix, (acc.get(suffix) ?? 0) + 1);
        }
        return acc;
      }, new Map());

      return Array.from(statMap.entries()).filter(a => a[1] > 9).sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]));
    });

  return Promise.all([
    createRuleset(
      span,
      'Sukka\'s Ruleset - Reject Base',
      [
        ...SHARED_DESCRIPTION,
        '',
        'The domainset supports AD blocking, tracking protection, privacy protection, anti-phishing, anti-mining',
        '',
        'Build from:',
        ...HOSTS.map(host => ` - ${host[0]}`),
        ...DOMAIN_LISTS.map(domainList => ` - ${domainList[0]}`),
        ...ADGUARD_FILTERS.map(filter => ` - ${Array.isArray(filter) ? filter[0] : filter}`)
      ],
      new Date(),
      span.traceChildSync('sort reject domainset (base)', () => sortDomains(dudupedDominArray, domainArrayMainDomainMap, domainArraySubdomainMap)),
      'domainset',
      path.resolve(__dirname, '../List/domainset/reject.conf'),
      path.resolve(__dirname, '../Clash/domainset/reject.txt')
    ),
    createRuleset(
      span,
      'Sukka\'s Ruleset - Reject Extra',
      [
        ...SHARED_DESCRIPTION,
        '',
        'The domainset supports AD blocking, tracking protection, privacy protection, anti-phishing, anti-mining',
        '',
        'Build from:',
        ...HOSTS_EXTRA.map(host => ` - ${host[0]}`),
        ...DOMAIN_LISTS_EXTRA.map(domainList => ` - ${domainList[0]}`),
        ...ADGUARD_FILTERS_EXTRA.map(filter => ` - ${Array.isArray(filter) ? filter[0] : filter}`),
        ...PHISHING_DOMAIN_LISTS_EXTRA.map(domainList => ` - ${domainList[0]}`)
      ],
      new Date(),
      span.traceChildSync('sort reject domainset (extra)', () => sortDomains(dudupedDominArrayExtra, domainArrayMainDomainMap, domainArraySubdomainMap)),
      'domainset',
      path.resolve(__dirname, '../List/domainset/reject_extra.conf'),
      path.resolve(__dirname, '../Clash/domainset/reject_extra.txt')
    ),
    compareAndWriteFile(
      span,
      rejectDomainsStats.map(([domain, count]) => `${domain}${' '.repeat(100 - domain.length)}${count}`),
      path.resolve(__dirname, '../Internal/reject-stats.txt')
    )
  ]);
});
