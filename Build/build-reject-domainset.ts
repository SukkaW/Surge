// @ts-check
import path from 'path';

import { processHosts, processFilterRules, processDomainLists } from './lib/parse-filter';
import { createTrie } from './lib/trie';

import { HOSTS, ADGUARD_FILTERS, PREDEFINED_WHITELIST, PREDEFINED_ENFORCED_BACKLIST, DOMAIN_LISTS } from './lib/reject-data-source';
import { createRuleset, compareAndWriteFile } from './lib/create-file';
import { processLine } from './lib/process-line';
import { domainDeduper } from './lib/domain-deduper';
import createKeywordFilter from './lib/aho-corasick';
import { readFileByLine } from './lib/fetch-text-by-line';
import { sortDomains } from './lib/stable-sort-domain';
import { traceSync, task, traceAsync } from './lib/trace-runner';
import { getGorhillPublicSuffixPromise } from './lib/get-gorhill-publicsuffix';
import * as tldts from 'tldts';
import { SHARED_DESCRIPTION } from './lib/constants';
import { getPhishingDomains } from './lib/get-phishing-domains';

export const buildRejectDomainSet = task(import.meta.path, async () => {
  /** Whitelists */
  const filterRuleWhitelistDomainSets = new Set(PREDEFINED_WHITELIST);
  const domainKeywordsSet = new Set<string>();
  const domainSuffixSet = new Set<string>();

  const domainSets = new Set<string>();

  // Parse from AdGuard Filters
  const [gorhill, shouldStop] = await traceAsync('* Download and process Hosts / AdBlock Filter Rules', async () => {
    let shouldStop = false;

    const [gorhill] = await Promise.all([
      getGorhillPublicSuffixPromise(),
      // Parse from remote hosts & domain lists
      ...HOSTS.map(entry => processHosts(entry[0], entry[1], entry[2], entry[3]).then(hosts => {
        hosts.forEach(host => {
          domainSets.add(host);
        });
      })),
      ...DOMAIN_LISTS.map(entry => processDomainLists(entry[0], entry[1], entry[2])),
      ...ADGUARD_FILTERS.map(input => {
        const promise = typeof input === 'string'
          ? processFilterRules(input)
          : processFilterRules(input[0], input[1], input[2]);

        return promise.then(({ white, black, foundDebugDomain }) => {
          if (foundDebugDomain) {
            shouldStop = true;
            // we should not break here, as we want to see full matches from all data source
          }
          white.forEach(i => filterRuleWhitelistDomainSets.add(i));
          black.forEach(i => domainSets.add(i));
        });
      }),
      ...([
        'https://raw.githubusercontent.com/AdguardTeam/AdGuardSDNSFilter/master/Filters/exceptions.txt',
        'https://raw.githubusercontent.com/AdguardTeam/AdGuardSDNSFilter/master/Filters/exclusions.txt'
      ].map(input => processFilterRules(input).then(({ white, black }) => {
        white.forEach(i => filterRuleWhitelistDomainSets.add(i));
        black.forEach(i => filterRuleWhitelistDomainSets.add(i));
      }))),
      getPhishingDomains().then(([purePhishingDomains, fullDomainSet]) => {
        fullDomainSet.forEach(host => {
          if (host) {
            domainSets.add(host);
          }
        });
        purePhishingDomains.forEach(suffix => domainSets.add(`.${suffix}`));
      }),
      (async () => {
        for await (const line of readFileByLine(path.resolve(import.meta.dir, '../Source/domainset/reject_sukka.conf'))) {
          const l = processLine(line);
          if (l) {
            domainSets.add(l);
          }
        }
      })()
    ]);

    // remove pre-defined enforced blacklist from whitelist
    const trie0 = createTrie(filterRuleWhitelistDomainSets);
    PREDEFINED_ENFORCED_BACKLIST.forEach(enforcedBlack => {
      trie0.find(enforcedBlack).forEach(found => filterRuleWhitelistDomainSets.delete(found));
    });

    return [gorhill, shouldStop] as const;
  });

  if (shouldStop) {
    process.exit(1);
  }

  let previousSize = domainSets.size;
  console.log(`Import ${previousSize} rules from Hosts / AdBlock Filter Rules & reject_sukka.conf!`);

  for await (const line of readFileByLine(path.resolve(import.meta.dir, '../Source/non_ip/reject.conf'))) {
    const [type, keyword] = line.split(',');

    if (type === 'DOMAIN-KEYWORD') {
      domainKeywordsSet.add(keyword.trim());
    } else if (type === 'DOMAIN-SUFFIX') {
      domainSuffixSet.add(keyword.trim());
    }
  }

  console.log(`Import ${domainKeywordsSet.size} black keywords and ${domainSuffixSet.size} black suffixes!`);

  previousSize = domainSets.size;
  // Dedupe domainSets
  traceSync('* Dedupe from black keywords/suffixes', () => {
    const trie1 = createTrie(domainSets);
    domainSuffixSet.forEach(suffix => {
      trie1.find(suffix, true).forEach(f => domainSets.delete(f));
    });
    filterRuleWhitelistDomainSets.forEach(suffix => {
      trie1.find(suffix, true).forEach(f => domainSets.delete(f));
    });

    // remove pre-defined enforced blacklist from whitelist
    const kwfilter = createKeywordFilter(domainKeywordsSet);

    // Build whitelist trie, to handle case like removing `g.msn.com` due to white `.g.msn.com` (`@@||g.msn.com`)
    const trieWhite = createTrie(filterRuleWhitelistDomainSets);
    for (const domain of domainSets) {
      if (domain[0] === '.') {
        if (trieWhite.contains(domain)) {
          domainSets.delete(domain);
          continue;
        }
      } else if (trieWhite.has(`.${domain}`)) {
        domainSets.delete(domain);
        continue;
      }

      // Remove keyword
      if (kwfilter.search(domain)) {
        domainSets.delete(domain);
      }
    }

    console.log(`Deduped ${previousSize} - ${domainSets.size} = ${previousSize - domainSets.size} from black keywords and suffixes!`);
  });
  previousSize = domainSets.size;

  // Dedupe domainSets
  const dudupedDominArray = traceSync('* Dedupe from covered subdomain', () => domainDeduper(Array.from(domainSets)));
  console.log(`Deduped ${previousSize - dudupedDominArray.length} rules from covered subdomain!`);
  console.log(`Final size ${dudupedDominArray.length}`);

  // Create reject stats
  const rejectDomainsStats: Array<[string, number]> = traceSync(
    '* Collect reject domain stats',
    () => Object.entries(
      dudupedDominArray.reduce<Record<string, number>>((acc, cur) => {
        const suffix = tldts.getDomain(cur, { allowPrivateDomains: false, detectIp: false, validateHostname: false });
        if (suffix) {
          acc[suffix] = (acc[suffix] ?? 0) + 1;
        }
        return acc;
      }, {})
    ).filter(a => a[1] > 10).sort((a, b) => {
      const t = b[1] - a[1];
      if (t !== 0) {
        return t;
      }

      return a[0].localeCompare(b[0]);
    })
  );

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
    ...createRuleset(
      'Sukka\'s Ruleset - Reject Base',
      description,
      new Date(),
      traceSync('* Sort reject domainset', () => sortDomains(dudupedDominArray, gorhill)),
      'domainset',
      path.resolve(import.meta.dir, '../List/domainset/reject.conf'),
      path.resolve(import.meta.dir, '../Clash/domainset/reject.txt')
    ),
    compareAndWriteFile(
      rejectDomainsStats.map(([domain, count]) => `${domain}${' '.repeat(100 - domain.length)}${count}`),
      path.resolve(import.meta.dir, '../List/internal/reject-stats.txt')
    ),
    Bun.write(
      path.resolve(import.meta.dir, '../List/domainset/reject_sukka.conf'),
      '# The file has been deprecated, its content has been merged into the main `reject` domainset.\n'
    )
  ]);
});

if (import.meta.main) {
  buildRejectDomainSet();
}
