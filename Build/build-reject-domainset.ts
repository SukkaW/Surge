// @ts-check
import path from 'path';

import { processHosts, processFilterRules, processDomainLists } from './lib/parse-filter';
import { createTrie } from './lib/trie';

import { HOSTS, ADGUARD_FILTERS, PREDEFINED_WHITELIST, DOMAIN_LISTS } from './lib/reject-data-source';
import { createRuleset, compareAndWriteFile } from './lib/create-file';
import { domainDeduper } from './lib/domain-deduper';
import createKeywordFilter from './lib/aho-corasick';
import { readFileByLine, readFileIntoProcessedArray } from './lib/fetch-text-by-line';
import { sortDomains } from './lib/stable-sort-domain';
import { task } from './trace';
import { getGorhillPublicSuffixPromise } from './lib/get-gorhill-publicsuffix';
import * as tldts from 'tldts';
import { SHARED_DESCRIPTION } from './lib/constants';
import { getPhishingDomains } from './lib/get-phishing-domains';

import * as SetHelpers from 'mnemonist/set';
import { setAddFromArray } from './lib/set-add-from-array';
import type { PublicSuffixList } from '@gorhill/publicsuffixlist';

export const buildRejectDomainSet = task(import.meta.path, async (span) => {
  const gorhillPromise = getGorhillPublicSuffixPromise();
  const gorhillPeeked = Bun.peek(gorhillPromise);
  const gorhill: PublicSuffixList = gorhillPeeked === gorhillPromise
    ? await gorhillPromise
    : (gorhillPeeked as PublicSuffixList);

  /** Whitelists */
  const filterRuleWhitelistDomainSets = new Set(PREDEFINED_WHITELIST);

  const domainSets = new Set<string>();

  // Parse from AdGuard Filters
  const shouldStop = await span
    .traceChild('download and process hosts / adblock filter rules')
    .traceAsyncFn(async (childSpan) => {
      // eslint-disable-next-line sukka/no-single-return -- not single return
      let shouldStop = false;
      await Promise.all([
        // Parse from remote hosts & domain lists
        ...HOSTS.map(entry => processHosts(childSpan, entry[0], entry[1], entry[2], entry[3]).then(hosts => SetHelpers.add(domainSets, hosts))),

        ...DOMAIN_LISTS.map(entry => processDomainLists(childSpan, entry[0], entry[1], entry[2]).then(hosts => SetHelpers.add(domainSets, hosts))),

        ...ADGUARD_FILTERS.map(input => (
          typeof input === 'string'
            ? processFilterRules(childSpan, input)
            : processFilterRules(childSpan, input[0], input[1], input[2])
        ).then(({ white, black, foundDebugDomain }) => {
          if (foundDebugDomain) {
            // eslint-disable-next-line sukka/no-single-return -- not single return
            shouldStop = true;
            // we should not break here, as we want to see full matches from all data source
          }
          setAddFromArray(filterRuleWhitelistDomainSets, white);
          setAddFromArray(domainSets, black);
        })),
        ...([
          'https://raw.githubusercontent.com/AdguardTeam/AdGuardSDNSFilter/master/Filters/exceptions.txt',
          'https://raw.githubusercontent.com/AdguardTeam/AdGuardSDNSFilter/master/Filters/exclusions.txt'
        ].map(input => processFilterRules(childSpan, input).then(({ white, black }) => {
          setAddFromArray(filterRuleWhitelistDomainSets, white);
          setAddFromArray(filterRuleWhitelistDomainSets, black);
        }))),
        getPhishingDomains(childSpan).then(([purePhishingDomains, fullPhishingDomainSet]) => {
          SetHelpers.add(domainSets, fullPhishingDomainSet);
          setAddFromArray(domainSets, purePhishingDomains);
        }),
        childSpan.traceChildAsync('process reject_sukka.conf', async () => {
          setAddFromArray(domainSets, await readFileIntoProcessedArray(path.resolve(import.meta.dir, '../Source/domainset/reject_sukka.conf')));
        })
      ]);
      // eslint-disable-next-line sukka/no-single-return -- not single return
      return shouldStop;
    });

  if (shouldStop) {
    process.exit(1);
  }

  let previousSize = domainSets.size;
  console.log(`Import ${previousSize} rules from Hosts / AdBlock Filter Rules & reject_sukka.conf!`);

  // Dedupe domainSets
  await span.traceChildAsync('dedupe from black keywords/suffixes', async (childSpan) => {
    /** Collect DOMAIN-SUFFIX from non_ip/reject.conf for deduplication */
    const domainSuffixSet = new Set<string>();
    /** Collect DOMAIN-KEYWORD from non_ip/reject.conf for deduplication */
    const domainKeywordsSet = new Set<string>();

    await childSpan.traceChildAsync('collect keywords/suffixes', async () => {
      for await (const line of readFileByLine(path.resolve(import.meta.dir, '../Source/non_ip/reject.conf'))) {
        const [type, value] = line.split(',');

        if (type === 'DOMAIN-KEYWORD') {
          domainKeywordsSet.add(value.trim());
        } else if (type === 'DOMAIN-SUFFIX') {
          domainSuffixSet.add(value.trim());
        }
      }
    });

    // Remove as many domains as possible from domainSets before creating trie
    SetHelpers.subtract(domainSets, domainSuffixSet);
    SetHelpers.subtract(domainSets, filterRuleWhitelistDomainSets);

    childSpan.traceChildSync('dedupe from white/suffixes', () => {
      const trie = createTrie(domainSets);

      domainSuffixSet.forEach(suffix => {
        trie.substractSetInPlaceFromFound(suffix, domainSets);
      });
      filterRuleWhitelistDomainSets.forEach(suffix => {
        trie.substractSetInPlaceFromFound(suffix, domainSets);
        domainSets.delete(
          suffix[0] === '.'
            ? suffix.slice(1) // handle case like removing `g.msn.com` due to white `.g.msn.com` (`@@||g.msn.com`)
            : `.${suffix}` // If `g.msn.com` is whitelisted, then `.g.msn.com` should be removed from domain set
        );
      });
    });

    childSpan.traceChildSync('dedupe from black keywords', () => {
      const kwfilter = createKeywordFilter(domainKeywordsSet);

      for (const domain of domainSets) {
      // Remove keyword
        if (kwfilter(domain)) {
          domainSets.delete(domain);
        }
      }
    });

    console.log(`Deduped ${previousSize} - ${domainSets.size} = ${previousSize - domainSets.size} from black keywords and suffixes!`);
  });
  previousSize = domainSets.size;

  // Dedupe domainSets
  const dudupedDominArray = span.traceChildSync('dedupe from covered subdomain', () => domainDeduper(Array.from(domainSets)));

  console.log(`Deduped ${previousSize - dudupedDominArray.length} rules from covered subdomain!`);
  console.log(`Final size ${dudupedDominArray.length}`);

  // Create reject stats
  const rejectDomainsStats: Array<[string, number]> = span
    .traceChild('create reject stats')
    .traceSyncFn(() => {
      const tldtsOpt = { allowPrivateDomains: false, detectIp: false, validateHostname: false };
      const statMap = dudupedDominArray.reduce<Map<string, number>>((acc, cur) => {
        const suffix = tldts.getDomain(cur, tldtsOpt);
        if (!suffix) return acc;

        if (acc.has(suffix)) {
          acc.set(suffix, acc.get(suffix)! + 1);
        } else {
          acc.set(suffix, 1);
        }
        return acc;
      }, new Map());

      return Array.from(statMap.entries()).filter(a => a[1] > 9).sort((a, b) => (b[1] - a[1]));
    });

  const description = [
    ...SHARED_DESCRIPTION,
    '',
    'The domainset supports AD blocking, tracking protection, privacy protection, anti-phishing, anti-mining',
    '',
    'Build from:',
    ...HOSTS.map(host => ` - ${host[0]}`),
    ...DOMAIN_LISTS.map(domainList => ` - ${domainList[0]}`),
    ...ADGUARD_FILTERS.map(filter => ` - ${Array.isArray(filter) ? filter[0] : filter}`),
    ' - https://curbengh.github.io/phishing-filter/phishing-filter-hosts.txt',
    ' - https://phishing.army/download/phishing_army_blocklist.txt'
  ];

  return Promise.all([
    createRuleset(
      span,
      'Sukka\'s Ruleset - Reject Base',
      description,
      new Date(),
      span.traceChildSync('sort reject domainset', () => sortDomains(dudupedDominArray, gorhill)),
      'domainset',
      path.resolve(import.meta.dir, '../List/domainset/reject.conf'),
      path.resolve(import.meta.dir, '../Clash/domainset/reject.txt')
    ),
    compareAndWriteFile(
      span,
      rejectDomainsStats.map(([domain, count]) => `${domain}${' '.repeat(100 - domain.length)}${count}`),
      path.resolve(import.meta.dir, '../List/internal/reject-stats.txt')
    )
  ]);
});

if (import.meta.main) {
  buildRejectDomainSet();
}
