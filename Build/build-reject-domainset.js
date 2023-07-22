// @ts-check
const fs = require('fs');
const fse = require('fs-extra');
const readline = require('readline');

const { resolve: pathResolve } = require('path');
const { processHosts, processFilterRules } = require('./lib/parse-filter');
const { getDomain } = require('tldts');
const Trie = require('./lib/trie');

const { HOSTS, ADGUARD_FILTERS, PREDEFINED_WHITELIST, PREDEFINED_ENFORCED_BACKLIST } = require('./lib/reject-data-source');
const { withBannerArray } = require('./lib/with-banner');
const { compareAndWriteFile } = require('./lib/string-array-compare');
const { processLine } = require('./lib/process-line');
const { domainDeduper } = require('./lib/domain-deduper');
const createKeywordFilter = require('./lib/aho-corasick');

/** Whitelists */
const filterRuleWhitelistDomainSets = new Set(PREDEFINED_WHITELIST);
/** @type {Set<string>} Dedupe domains inclued by DOMAIN-KEYWORD */
const domainKeywordsSet = new Set();
/** @type {Set<string>} Dedupe domains included by DOMAIN-SUFFIX */
const domainSuffixSet = new Set();

(async () => {
  console.time('Total Time - build-reject-domain-set');

  /** @type Set<string> */
  const domainSets = new Set();

  // Parse from AdGuard Filters
  console.time('* Download and process Hosts / AdBlock Filter Rules');

  let shouldStop = false;

  await Promise.all([
    // Parse from remote hosts & domain lists
    Promise.all(HOSTS.map(entry => processHosts(entry[0], entry[1])))
      .then(r => r.forEach(hosts => {
        hosts.forEach(host => {
          if (host) {
            domainSets.add(host);
          }
        });
      })),
    Promise.all(ADGUARD_FILTERS.map(input => {
      const promise = typeof input === 'string'
        ? processFilterRules(input, undefined, false)
        : processFilterRules(input[0], input[1] || undefined, input[2] ?? false);

      return promise.then((i) => {
        if (i) {
          const { white, black, foundDebugDomain } = i;
          if (foundDebugDomain) {
            shouldStop = true;
          }
          white.forEach(i => {
            // if (PREDEFINED_ENFORCED_BACKLIST.some(j => i.endsWith(j))) {
            //   return;
            // }
            filterRuleWhitelistDomainSets.add(i);
          });
          black.forEach(i => domainSets.add(i));
        } else {
          process.exit(1);
        }
      });
    })),
    Promise.all([
      'https://raw.githubusercontent.com/AdguardTeam/AdGuardSDNSFilter/master/Filters/exceptions.txt',
      'https://raw.githubusercontent.com/AdguardTeam/AdGuardSDNSFilter/master/Filters/exclusions.txt'
    ].map(
      input => processFilterRules(input).then((i) => {
        if (i) {
          const { white, black } = i;
          white.forEach(i => {
            // if (PREDEFINED_ENFORCED_BACKLIST.some(j => i.endsWith(j))) {
            //   return;
            // }
            filterRuleWhitelistDomainSets.add(i);
          });
          black.forEach(i => {
            // if (PREDEFINED_ENFORCED_BACKLIST.some(j => i.endsWith(j))) {
            //   return;
            // }
            filterRuleWhitelistDomainSets.add(i);
          });
        } else {
          process.exit(1);
        }
      })
    ))
  ]);

  const trie0 = Trie.from(Array.from(filterRuleWhitelistDomainSets));
  PREDEFINED_ENFORCED_BACKLIST.forEach(enforcedBlack => {
    trie0.find(enforcedBlack).forEach(found => filterRuleWhitelistDomainSets.delete(found));
  });

  console.timeEnd('* Download and process Hosts / AdBlock Filter Rules');

  if (shouldStop) {
    process.exit(1);
  }

  let previousSize = domainSets.size;
  console.log(`Import ${previousSize} rules from Hosts / AdBlock Filter Rules!`);

  const rl1 = readline.createInterface({
    input: fs.createReadStream(pathResolve(__dirname, '../Source/domainset/reject_sukka.conf'), { encoding: 'utf-8' }),
    crlfDelay: Infinity
  });

  for await (const line of rl1) {
    const l = processLine(line);
    if (l) {
      domainSets.add(l);
    }
  }

  previousSize = domainSets.size - previousSize;
  console.log(`Import ${previousSize} rules from reject_sukka.conf!`);

  const rl2 = readline.createInterface({
    input: fs.createReadStream(pathResolve(__dirname, '../List/non_ip/reject.conf'), { encoding: 'utf-8' }),
    crlfDelay: Infinity
  });
  for await (const line of rl2) {
    if (line.startsWith('DOMAIN-KEYWORD')) {
      const [, ...keywords] = line.split(',');
      domainKeywordsSet.add(keywords.join(',').trim());
    } else if (line.startsWith('DOMAIN-SUFFIX')) {
      const [, ...keywords] = line.split(',');
      domainSuffixSet.add(keywords.join(',').trim());
    }
  }

  const rl3 = readline.createInterface({
    input: fs.createReadStream(pathResolve(__dirname, '../List/domainset/reject_phishing.conf'), { encoding: 'utf-8' }),
    crlfDelay: Infinity
  });
  for await (const line of rl3) {
    const l = processLine(line);
    if (l && l[0] === '.') {
      domainSuffixSet.add(l.slice(1));
    }
  }

  console.log(`Import ${domainKeywordsSet.size} black keywords and ${domainSuffixSet.size} black suffixes!`);

  previousSize = domainSets.size;
  // Dedupe domainSets
  console.log(`Start deduping from black keywords/suffixes! (${previousSize})`);
  console.time('* Dedupe from black keywords/suffixes');

  const kwfilter = createKeywordFilter(Array.from(domainKeywordsSet));

  const trie1 = Trie.from(Array.from(domainSets));
  domainSuffixSet.forEach(suffix => {
    trie1.find(suffix, true).forEach(f => domainSets.delete(f));
  });
  filterRuleWhitelistDomainSets.forEach(suffix => {
    trie1.find(suffix, true).forEach(f => domainSets.delete(f));
  });

  // Build whitelist trie, to handle case like removing `g.msn.com` due to white `.g.msn.com` (`@@||g.msn.com`)
  const trieWhite = Trie.from(Array.from(filterRuleWhitelistDomainSets));
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

  console.timeEnd('* Dedupe from black keywords/suffixes');
  console.log(`Deduped ${previousSize} - ${domainSets.size} = ${previousSize - domainSets.size} from black keywords and suffixes!`);

  previousSize = domainSets.size;
  // Dedupe domainSets
  console.log(`Start deduping! (${previousSize})`);

  const START_TIME = Date.now();

  const dudupedDominArray = domainDeduper(Array.from(domainSets));

  console.log(`* Dedupe from covered subdomain - ${(Date.now() - START_TIME) / 1000}s`);
  console.log(`Deduped ${previousSize - dudupedDominArray.length} rules!`);

  console.time('* Write reject.conf');

  const sorter = (a, b) => {
    if (a.domain > b.domain) {
      return 1;
    }
    if (a.domain < b.domain) {
      return -1;
    }
    return 0;
  };
  const sortedDomainSets = dudupedDominArray
    .map((v) => {
      return { v, domain: getDomain(v.charCodeAt(0) === 46 ? v.slice(1) : v) || v };
    })
    .sort(sorter)
    .map((i) => i.v);

  await compareAndWriteFile(
    withBannerArray(
      'Sukka\'s Surge Rules - Reject Base',
      [
        'License: AGPL 3.0',
        'Homepage: https://ruleset.skk.moe',
        'GitHub: https://github.com/SukkaW/Surge',
        '',
        'The domainset supports AD blocking, tracking protection, privacy protection, anti-phishing, anti-mining',
        '',
        'Build from:',
        ...HOSTS.map(host => ` - ${host[0]}`),
        ...ADGUARD_FILTERS.map(filter => ` - ${Array.isArray(filter) ? filter[0] : filter}`)
      ],
      new Date(),
      sortedDomainSets
    ),
    pathResolve(__dirname, '../List/domainset/reject.conf')
  );

  // Copy reject_sukka.conf for backward compatibility
  await fse.copy(pathResolve(__dirname, '../Source/domainset/reject_sukka.conf'), pathResolve(__dirname, '../List/domainset/reject_sukka.conf'));

  console.timeEnd('* Write reject.conf');

  console.timeEnd('Total Time - build-reject-domain-set');
})();
