const { simpleGet } = require('./util-http-get');
const { promises: fsPromises } = require('fs');
const { resolve: pathResolve } = require('path');

let cliProgress;
let Piscina;
try {
  Piscina = require('piscina');
  cliProgress = require('cli-progress');
} catch (e) {
  console.log('Dependencies not found');
  console.log('"npm i cli-progress piscina" then try again!');

  console.error(e);
  process.exit(1);
}

/**
 * @param {string | URL} hostsUrl
 */
async function processHosts(hostsUrl, includeAllSubDomain = false) {
  if (typeof hostsUrl === 'string') {
    hostsUrl = new URL(hostsUrl);
  }

  /** @type Set<string> */
  const domainSets = new Set();

  /** @type string[] */
  const hosts = (await simpleGet.https(hostsUrl)).split('\n');
  hosts.forEach(line => {
    if (line.startsWith('#')) {
      return;
    }
    if (line.startsWith(' ') || line === '' || line.startsWith('\r') || line.startsWith('\n')) {
      return;
    }
    const [, ...domains] = line.split(' ');
    if (includeAllSubDomain) {
      domainSets.add(`.${domains.join(' ')}`.trim());
    } else {
      domainSets.add(domains.join(' ').trim());
    }
  });

  return [...domainSets];
}

/**
 * @param {string | URL} filterRulesUrl
 * @returns {Promise<{ white: Set<string>, black: Set<string> }>}
 */
async function processFilterRules(filterRulesUrl) {
  if (typeof filterRulesUrl === 'string') {
    filterRulesUrl = new URL(filterRulesUrl);
  }

  /** @type Set<string> */
  const whitelistDomainSets = new Set([
    'localhost',
    'analytics.google.com',
    'msa.cdn.mediaset.net' // Added manually using DOMAIN-KEYWORDS
  ]);
  /** @type Set<string> */
  const blacklistDomainSets = new Set();

  /** @type string[] */
  const filterRules = (await simpleGet.https(filterRulesUrl.hostname, filterRulesUrl.pathname)).split('\n');
  filterRules.forEach(line => {
    if (
      line.startsWith('#')
      || line.startsWith('!')
      || line.startsWith(' ')
      || line === ''
      || line.startsWith('\r')
      || line.startsWith('\n')
      || line.includes('*')
      || line.includes('/')
      || line.includes('$')
    ) {
      return;
    }

    if (line.startsWith('@@||')
      && (
        line.endsWith('^')
        || line.endsWith('^|')
      )
    ) {
      whitelistDomainSets.add(`${line.replaceAll('@@||', '').replaceAll('^|', '').replaceAll('^', '')}`.trim());
    } else if (
      line.startsWith('||')
      && (
        line.endsWith('^')
        || line.endsWith('^|')
      )
    ) {
      blacklistDomainSets.add(`.${line.replaceAll('||', '').replaceAll('^|', '').replaceAll('^', '')}`.trim());
    } else if (line.startsWith('://')
      && (
        line.endsWith('^')
        || line.endsWith('^|')
      )
    ) {
      blacklistDomainSets.add(`${line.replaceAll('://', '').replaceAll('^|', '').replaceAll('^', '')}`.trim());
    }
  });

  return {
    white: whitelistDomainSets,
    black: blacklistDomainSets
  };
}

(async () => {
  /** @type Set<string> */
  const domainSets = new Set();

  // Parse from remote hosts
  (await Promise.all([
    processHosts('https://pgl.yoyo.org/adservers/serverlist.php?hostformat=hosts&showintro=1&mimetype=plaintext', true),
    processHosts('https://raw.githubusercontent.com/hoshsadiq/adblock-nocoin-list/master/hosts.txt'),
    processHosts('https://cdn.jsdelivr.net/gh/neoFelhz/neohosts@gh-pages/full/hosts')
  ])).forEach(hosts => {
    hosts.forEach(host => {
      if (host) {
        domainSets.add(host.trim());
      }
    });
  });

  console.log(`Import ${domainSets.size} rules from hosts files!`);

  await fsPromises.readFile(pathResolve(__dirname, '../List/domainset/reject_sukka.conf'), { encoding: 'utf-8' }).then(data => {
    data.split('\n').forEach(line => {
      if (
        line.startsWith('#')
        || line.startsWith(' ')
        || line === '' || line === ' '
        || line.startsWith('\r')
        || line.startsWith('\n')
      ) {
        return;
      }

      /* if (domainSets.has(line) || domainSets.has(`.${line}`)) {
        console.warn(`|${line}| is already in the list!`);
      } */
      domainSets.add(line.trim());
    });
  });

  console.log(`Import rules from reject_sukka.conf!`);

  // Parse from AdGuard Filters
  /** @type Set<string> */
  const filterRuleWhitelistDomainSets = new Set();
  (await Promise.all([
    processFilterRules('https://easylist.to/easylist/easylist.txt'),
    processFilterRules('https://adguardteam.github.io/AdGuardSDNSFilter/Filters/filter.txt'),
    processFilterRules('https://raw.githubusercontent.com/AdguardTeam/FiltersRegistry/master/filters/filter_11_Mobile/filter.txt'),
    processFilterRules('https://raw.githubusercontent.com/AdguardTeam/FiltersRegistry/master/filters/filter_3_Spyware/filter.txt'),
    processFilterRules('https://raw.githubusercontent.com/AdguardTeam/FiltersRegistry/master/filters/filter_2_English/filter.txt'),
    processFilterRules('https://raw.githubusercontent.com/AdguardTeam/FiltersRegistry/master/filters/filter_224_Chinese/filter.txt')
  ])).forEach(({ white, black }) => {
    white.forEach(i => filterRuleWhitelistDomainSets.add(i));
    black.forEach(i => domainSets.add(i));
  });

  console.log(`Import rules from adguard filters!`);

  // Read DOMAIN Keyword
  const domainKeywordsSet = new Set();
  await fsPromises.readFile(pathResolve(__dirname, '../List/non_ip/reject.conf'), { encoding: 'utf-8' }).then(data => {
    data.split('\n').forEach(line => {
      if (line.startsWith('DOMAIN-KEYWORD')) {
        const [, ...keywords] = line.split(',');
        domainKeywordsSet.add(keywords.join(',').trim());
      }
    });
  });

  console.log(`Import ${domainKeywordsSet.size} black keywords!`);

  // Dedupe domainSets
  console.log(`Start deduping!`);

  const piscina = new Piscina({
    filename: pathResolve(__dirname, 'worker/build-reject-domainset-worker.js')
  });

  const res = await Promise.all([
    piscina.run({ keywords: domainKeywordsSet, input: domainSets }, { name: 'dedupeKeywords' }),
    piscina.run({ whiteList: filterRuleWhitelistDomainSets, input: domainSets }, { name: 'whitelisted' }),
    ...sliceIntoChunks(Array.from(domainSets), 5000).map(chunk => piscina.run({ input: chunk, fullSet: domainSets }, { name: 'dedupe' }))
  ]);

  res.forEach(set => {
    set.forEach(i => domainSets.delete(i));
  });

  return fsPromises.writeFile(pathResolve(__dirname, '../List/domainset/reject.conf'), `${[...domainSets].join('\n')}\n`);
})();

function sliceIntoChunks(arr, chunkSize) {
  const res = [];
  for (let i = 0; i < arr.length; i += chunkSize) {
    const chunk = arr.slice(i, i + chunkSize);
    res.push(chunk);
  }
  return res;
}
