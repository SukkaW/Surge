const { simpleGet } = require('./util-http-get');
const { promises: fsPromises } = require('fs');
const { resolve: pathResolve } = require('path');

let cliProgress;
try {
  cliProgress = require('cli-progress');
} catch (e) {
  console.log('Dependencies not found');
  console.log('"npm i cli-progress" then try again!');

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
    domainSets.add(`${includeAllSubDomain ? '.' : ''}${domains.join(' ')}`);
  });

  return [...domainSets];
}

/**
 * @param {string | URL} filterRulesUrl
 * @returns {Promise<{ white: string[], black: string[] }>}
 */
async function processFilterRules(filterRulesUrl) {
  if (typeof filterRulesUrl === 'string') {
    filterRulesUrl = new URL(filterRulesUrl);
  }

  /** @type Set<string> */
  const whitelistDomainSets = new Set();
  /** @type Set<string> */
  const blacklistDomainSets = new Set();

  /** @type string[] */
  const filterRules = (await simpleGet.https(filterRulesUrl.hostname, filterRulesUrl.pathname)).split('\n');
  filterRules.forEach(line => {
    if (line.startsWith('#') || line.startsWith('!')) {
      return;
    }
    if (line.startsWith(' ') || line === '' || line.startsWith('\r') || line.startsWith('\n')) {
      return;
    }
    if (!line.includes('*') && !line.includes('//')) {
      if (line.startsWith('@@||') && line.endsWith('^')) {
        whitelistDomainSets.add(`${line.replaceAll('@@||', '').replaceAll('^', '')}`);
      } else if (line.startsWith('||') && line.endsWith('^')) {
        blacklistDomainSets.add(`${line.replaceAll('||', '').replaceAll('^', '')}`);
      }
    }
  });

  return {
    white: [...whitelistDomainSets],
    black: [...blacklistDomainSets]
  };
}

(async () => {
  /** @type Set<string> */
  const domainSets = new Set();

  // Parse from remote hosts
  (await Promise.all([
    processHosts('https://pgl.yoyo.org/adservers/serverlist.php?hostformat=hosts&showintro=1&mimetype=plaintext', true),
    processHosts('https://raw.githubusercontent.com/hoshsadiq/adblock-nocoin-list/master/hosts.txt'),
    processHosts('https://cdn.jsdelivr.net/gh/neoFelhz/neohosts@gh-pages/full/hosts'),
    processHosts('https://adaway.org/hosts.txt')
  ])).forEach(hosts => {
    hosts.forEach(host => {
      if (host) {
        domainSets.add(host);
      }
    });
  });

  console.log(`Import ${domainSets.size} rules from hosts files!`);

  console.log(`Start importing rules from reject_sukka.conf!`);

  await fsPromises.readFile(pathResolve(__dirname, '../List/domainset/reject_sukka.conf'), { encoding: 'utf-8' }).then(data => {
    data.split('\n').forEach(line => {
      if (
        line.startsWith('#')
        || line.startsWith(' ')
        || line === ''
        || line.startsWith('\r')
        || line.startsWith('\n')
      ) {
        return;
      }

      /* if (domainSets.has(line) || domainSets.has(`.${line}`)) {
        console.warn(`|${line}| is already in the list!`);
      } */
      domainSets.add(line);
    });
  });

  // Parse from AdGuard Filters
  /** @type Set<string> */
  const filterRuleWhitelistDomainSets = new Set();
  /** @type Set<string> */
  const filterRuleBlacklistDomainSets = new Set();
  (await Promise.all([
    processFilterRules('https://easylist.to/easylist/easylist.txt'),
    processFilterRules('https://adguardteam.github.io/AdGuardSDNSFilter/Filters/filter.txt'),
    processFilterRules('https://raw.githubusercontent.com/AdguardTeam/FiltersRegistry/master/filters/filter_11_Mobile/filter.txt'),
    processFilterRules('https://raw.githubusercontent.com/AdguardTeam/FiltersRegistry/master/filters/filter_3_Spyware/filter.txt'),
    processFilterRules('https://raw.githubusercontent.com/AdguardTeam/FiltersRegistry/master/filters/filter_2_English/filter.txt'),
    processFilterRules('https://raw.githubusercontent.com/AdguardTeam/FiltersRegistry/master/filters/filter_224_Chinese/filter.txt')
  ])).forEach(({ white, black }) => {
    white.forEach(i => filterRuleWhitelistDomainSets.add(i));
    black.forEach(i => filterRuleBlacklistDomainSets.add(i));
  });

  for (const black of filterRuleBlacklistDomainSets) {
    domainSets.add(`.${black}`);
  }

  console.log(`Import ${filterRuleBlacklistDomainSets.size} rules from adguard filters!`);

  // Read DOMAIN Keyword
  const domainKeywordsSet = new Set();
  await fsPromises.readFile(pathResolve(__dirname, '../List/non_ip/reject.conf'), { encoding: 'utf-8' }).then(data => {
    data.split('\n').forEach(line => {
      if (line.startsWith('DOMAIN-KEYWORD')) {
        const [, ...keywords] = line.split(',');
        domainKeywordsSet.add(keywords.join(','));
      }
    });
  });

  // Dedupe domainSets
  console.log(`Start deduping!`);
  const bar2 = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);

  const domainSetsClone = [...domainSets];
  const len = domainSetsClone.length;

  bar2.start(len, 0);
  for (const domain of domainSets) {
    let shouldContinue = false;

    for (const white of filterRuleWhitelistDomainSets) {
      if (domain.includes(white) || white.includes(domain)) {
        domainSets.delete(domain);
        shouldContinue = true;
        break;
      }
    }

    if (shouldContinue) {
      continue;
    }

    for (const keyword of domainKeywordsSet) {
      if (domain.includes(keyword) || keyword.includes(domain)) {
        domainSets.delete(domain);
        shouldContinue = true;
        break;
      }
    }

    if (shouldContinue) {
      continue;
    }

    for (const domain2 of domainSets) {
      if (domain2.startsWith('.') && domain2 !== domain && (domain.endsWith(domain2) || `.${domain}` === domain2)) {
        domainSets.delete(domain);
        break;
      }
    }

    bar2.increment();
  }

  bar2.stop();

  return fsPromises.writeFile(pathResolve(__dirname, '../List/domainset/reject.conf'), `${[...domainSets].join('\n')}\n`);
})();
