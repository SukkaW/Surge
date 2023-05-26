// @ts-check
const { promises: fsPromises } = require('fs');
const fse = require('fs-extra');
const { resolve: pathResolve } = require('path');
const Piscina = require('piscina');
const { processHosts, processFilterRules, preprocessFullDomainSetBeforeUsedAsWorkerData } = require('./lib/parse-filter');
const cpuCount = require('os').cpus().length;
const { isCI } = require('ci-info');
const threads = isCI ? cpuCount : cpuCount / 2;
const { getDomain } = require('tldts');

const { HOSTS, ADGUARD_FILTERS, PREDEFINED_WHITELIST, PREDEFINED_ENFORCED_BACKLIST } = require('./lib/reject-data-source');
const { withBannerArray } = require('./lib/with-banner');
const { compareAndWriteFile } = require('./lib/string-array-compare');

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

  console.log('Downloading hosts file...');
  console.time('* Download and process Hosts');

  // Parse from remote hosts & domain lists
  (await Promise.all(
    HOSTS.map(entry => processHosts(entry[0], entry[1]))
  )).forEach(hosts => {
    hosts.forEach(host => {
      if (host) {
        domainSets.add(host);
      }
    });
  });

  console.timeEnd('* Download and process Hosts');

  let previousSize = domainSets.size;
  console.log(`Import ${previousSize} rules from hosts files!`);

  // Parse from AdGuard Filters
  console.time('* Download and process AdBlock Filter Rules');

  let shouldStop = false;
  await Promise.all(ADGUARD_FILTERS.map(input => {
    const promise = typeof input === 'string'
      ? processFilterRules(input, undefined, false)
      : processFilterRules(input[0], input[1] || undefined, input[2] ?? false)

    return promise.then((i) => {
      if (i) {
        const { white, black, foundDebugDomain } = i;
        if (foundDebugDomain) {
          shouldStop = true;
        }
        white.forEach(i => {
          if (PREDEFINED_ENFORCED_BACKLIST.some(j => i.endsWith(j))) {
            return;
          }
          filterRuleWhitelistDomainSets.add(i);
        });
        black.forEach(i => domainSets.add(i));
      } else {
        process.exit(1);
      }
    });
  }));

  await Promise.all([
    'https://raw.githubusercontent.com/AdguardTeam/AdGuardSDNSFilter/master/Filters/exceptions.txt',
    'https://raw.githubusercontent.com/AdguardTeam/AdGuardSDNSFilter/master/Filters/exclusions.txt'
  ].map(
    input => processFilterRules(input).then((i) => {
      if (i) {
        const { white, black } = i;
        white.forEach(i => {
          if (PREDEFINED_ENFORCED_BACKLIST.some(j => i.endsWith(j))) {
            return;
          }
          filterRuleWhitelistDomainSets.add(i)
        });
        black.forEach(i => {
          if (PREDEFINED_ENFORCED_BACKLIST.some(j => i.endsWith(j))) {
            return;
          }
          filterRuleWhitelistDomainSets.add(i)
        });
      } else {
        process.exit(1);
      }
    })
  ));

  console.timeEnd('* Download and process AdBlock Filter Rules');

  if (shouldStop) {
    process.exit(1);
  }

  previousSize = domainSets.size - previousSize;
  console.log(`Import ${previousSize} rules from adguard filters!`);

  await fsPromises.readFile(pathResolve(__dirname, '../Source/domainset/reject_sukka.conf'), { encoding: 'utf-8' }).then(data => {
    data.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (
        line.startsWith('#')
        || line.startsWith(' ')
        || line.startsWith('\r')
        || line.startsWith('\n')
        || trimmed === ''
      ) {
        return;
      }

      domainSets.add(trimmed);
    });
  });

  previousSize = domainSets.size - previousSize;
  console.log(`Import ${previousSize} rules from reject_sukka.conf!`);

  await Promise.all([
    // Copy reject_sukka.conf for backward compatibility
    fse.copy(pathResolve(__dirname, '../Source/domainset/reject_sukka.conf'), pathResolve(__dirname, '../List/domainset/reject_sukka.conf')),
    fsPromises.readFile(pathResolve(__dirname, '../List/non_ip/reject.conf'), { encoding: 'utf-8' }).then(data => {
      data.split('\n').forEach(line => {
        if (line.startsWith('DOMAIN-KEYWORD')) {
          const [, ...keywords] = line.split(',');
          domainKeywordsSet.add(keywords.join(',').trim());
        } else if (line.startsWith('DOMAIN-SUFFIX')) {
          const [, ...keywords] = line.split(',');
          domainSuffixSet.add(keywords.join(',').trim());
        }
      });
    }),
    // Read Special Phishing Suffix list
    fsPromises.readFile(pathResolve(__dirname, '../List/domainset/reject_phishing.conf'), { encoding: 'utf-8' }).then(data => {
      data.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (
          line.startsWith('#')
          || line.startsWith(' ')
          || line.startsWith('\r')
          || line.startsWith('\n')
          || trimmed === ''
        ) {
          return;
        }

        domainSuffixSet.add(trimmed);
      });
    })
  ]);

  console.log(`Import ${domainKeywordsSet.size} black keywords and ${domainSuffixSet.size} black suffixes!`);

  previousSize = domainSets.size;
  // Dedupe domainSets
  console.log(`Start deduping from black keywords/suffixes! (${previousSize})`);
  console.time(`* Dedupe from black keywords/suffixes`);

  for (const domain of domainSets) {
    if (isMatchKeyword(domain) || isMatchSuffix(domain) || isInWhiteList(domain)) {
      domainSets.delete(domain);
    }
  }

  console.timeEnd(`* Dedupe from black keywords/suffixes`);
  console.log(`Deduped ${previousSize} - ${domainSets.size} = ${previousSize - domainSets.size} from black keywords and suffixes!`);

  previousSize = domainSets.size;
  // Dedupe domainSets
  console.log(`Start deduping! (${previousSize})`);

  const START_TIME = Date.now();

  const domainSetsArray = Array.from(domainSets);
  const piscina = new Piscina({
    filename: pathResolve(__dirname, 'worker/build-reject-domainset-worker.js'),
    workerData: preprocessFullDomainSetBeforeUsedAsWorkerData(Array.from(domainSetsArray)),
    idleTimeout: 50,
    minThreads: threads,
    maxThreads: threads
  });

  console.log(preprocessFullDomainSetBeforeUsedAsWorkerData(Array.from(domainSetsArray)).length);

  console.log(`Launching ${threads} threads...`);

  const tasksArray = domainSetsArray.reduce((result, element, index) => {
    const chunk = index % threads;
    result[chunk] ??= [];

    result[chunk].push(element);
    return result;
  }, /** @type {string[][]} */([]));

  (await Promise.all(
    tasksArray.map(chunk => piscina.run({ chunk }))
  )).forEach((result, taskIndex) => {
      const chunk = tasksArray[taskIndex];
      for (let i = 0, len = result.length; i < len; i++) {
        if (result[i]) {
          domainSets.delete(chunk[i]);
        }
      }
    });

  console.log(`* Dedupe from covered subdomain - ${(Date.now() - START_TIME) / 1000}s`);
  console.log(`Deduped ${previousSize - domainSets.size} rules!`);

  await piscina.destroy();

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
  const sortedDomainSets = Array.from(domainSets)
    .map((v) => {
      return { v, domain: getDomain(v.charCodeAt(0) === 46 ? v.slice(1) : v)?.toLowerCase() || v };
    })
    .sort(sorter)
    .map((i) => {
      return i.v;
    });

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
        ...ADGUARD_FILTERS.map(filter => ` - ${Array.isArray(filter) ? filter[0] : filter}`),
      ],
      new Date(),
      sortedDomainSets
    ),
    pathResolve(__dirname, '../List/domainset/reject.conf')
  );

  console.timeEnd('* Write reject.conf');

  console.timeEnd('Total Time - build-reject-domain-set');
  if (piscina.queueSize === 0) {
    process.exit(0);
  }
})();

/**
 * @param {string} domain
 */
function isMatchKeyword(domain) {
  for (const keyword of domainKeywordsSet) {
    if (domain.includes(keyword)) {
      return true;
    }
  }

  return false;
}

/**
 * @param {string} domain
 */
function isMatchSuffix(domain) {
  for (const suffix of domainSuffixSet) {
    if (domain.endsWith(suffix)) {
      return true;
    }
  }

  return false;
}

/**
 * @param {string} domain
 */
function isInWhiteList(domain) {
  for (const white of filterRuleWhitelistDomainSets) {
    if (domain === white || domain.endsWith(white)) {
      return true;
    }
    if (white.endsWith(domain)) {
      // If a whole domain is in blacklist but a subdomain is in whitelist
      // We have no choice but to remove the whole domain from blacklist
      return true;
    }
  }

  return false;
}
