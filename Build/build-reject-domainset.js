const { default: got } = require('got-cjs');
const { promises: fsPromises } = require('fs');
const { resolve: pathResolve } = require('path');
const { cpus } = require('os');
const { isIP } = require('net');

const threads = Math.max(cpus().length, 12);

const rDomain = /^(((?!\-))(xn\-\-)?[a-z0-9\-_]{0,61}[a-z0-9]{1,1}\.)*(xn\-\-)?([a-z0-9\-]{1,61}|[a-z0-9\-]{1,30})\.[a-z]{2,}$/m

const Piscina = require('piscina');

/**
 * @param {string | URL} domainListsUrl
 */
async function processDomainLists(domainListsUrl) {
  if (typeof domainListsUrl === 'string') {
    domainListsUrl = new URL(domainListsUrl);
  }

  /** @type Set<string> */
  const domainSets = new Set();
  /** @type string[] */
  const domains = (await got(domainListsUrl).text()).split('\n');
  domains.forEach(line => {
    if (
      line.startsWith('#')
      || line.startsWith('!')
      || line.startsWith(' ')
      || line === ''
      || line.startsWith('\r')
      || line.startsWith('\n')
    ) {
      return;
    }
    domainSets.add(line.trim());
  });

  return [...domainSets];
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
  const hosts = (await got(hostsUrl).text()).split('\n');
  hosts.forEach(line => {
    if (line.includes('#')) {
      return;
    }
    if (line.startsWith(' ') || line.startsWith('\r') || line.startsWith('\n') || line.trim() === '') {
      return;
    }
    const [, ...domains] = line.split(' ');
    const domain = domains.join(' ').trim();
    if (rDomain.test(domain)) {
      if (includeAllSubDomain) {
        domainSets.add(`.${domain}`);
      } else {
        domainSets.add(domain);
      }
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
  const whitelistDomainSets = new Set();
  /** @type Set<string> */
  const blacklistDomainSets = new Set();

  /** @type string[] */
  const filterRules = (await got(filterRulesUrl).text()).split('\n').map(line => line.trim());

  filterRules.forEach(line => {
    if (
      line === ''
      || line.includes('#')
      || line.includes('!')
      || line.includes('*')
      || line.includes('/')
      || line.includes('$') && !line.startsWith('@@')
      || line.trim() === ''
      || isIP(line) !== 0
    ) {
      return;
    }

    if (line.startsWith('@@||')
      && (
        line.endsWith('^')
        || line.endsWith('^|')
        || line.endsWith('^$badfilter')
        || line.endsWith('^$1p')
      )
    ) {
      const domain = line
        .replaceAll('@@||', '')
        .replaceAll('^$badfilter', '')
        .replaceAll('^$1p', '')
        .replaceAll('^|', '')
        .replaceAll('^', '')
        .trim();
      if (rDomain.test(domain)) {
        whitelistDomainSets.add(domain);
      }
    } else if (
      line.startsWith('||')
      && (
        line.endsWith('^')
        || line.endsWith('^|')
      )
    ) {
      const domain = `${line.replaceAll('||', '').replaceAll('^|', '').replaceAll('^', '')}`.trim();
      if (rDomain.test(domain)) {
        blacklistDomainSets.add(`.${domain}`);
      }
    } else if (line.startsWith('://')
      && (
        line.endsWith('^')
        || line.endsWith('^|')
      )
    ) {
      const domain = `${line.replaceAll('://', '').replaceAll('^|', '').replaceAll('^', '')}`.trim();
      if (rDomain.test(domain)) {
        blacklistDomainSets.add(domain);
      }
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

  // Parse from remote hosts & domain lists
  (await Promise.all([
    processHosts('https://pgl.yoyo.org/adservers/serverlist.php?hostformat=hosts&showintro=0&mimetype=plaintext', true),
    processHosts('https://raw.githubusercontent.com/hoshsadiq/adblock-nocoin-list/master/hosts.txt')
  ])).forEach(hosts => {
    hosts.forEach(host => {
      if (host) {
        domainSets.add(host);
      }
    });
  });

  const hostsSize = domainSets.size;
  console.log(`Import ${hostsSize} rules from hosts files!`);

  await fsPromises.readFile(pathResolve(__dirname, '../List/domainset/reject_sukka.conf'), { encoding: 'utf-8' }).then(data => {
    data.split('\n').forEach(line => {
      if (
        line.startsWith('#')
        || line.startsWith(' ')
        || line.startsWith('\r')
        || line.startsWith('\n')
        || line.trim() === ''
      ) {
        return;
      }

      /* if (domainSets.has(line) || domainSets.has(`.${line}`)) {
        console.warn(`|${line}| is already in the list!`);
      } */
      domainSets.add(line.trim());
    });
  });

  const sukkaSize = domainSets.size - hostsSize;
  console.log(`Import ${sukkaSize} rules from reject_sukka.conf!`);

  // Parse from AdGuard Filters
  /** @type Set<string> */
  const filterRuleWhitelistDomainSets = new Set([
    'localhost',
    'broadcasthost',
    'ip6-loopback',
    'ip6-localnet',
    'ip6-mcastprefix',
    'ip6-allnodes',
    'ip6-allrouters',
    'ip6-allhosts',
    'mcastprefix',
    'analytics.google.com',
    'msa.cdn.mediaset.net', // Added manually using DOMAIN-KEYWORDS
    'cloud.answerhub.com',
    'ae01.alicdn.com',
    'whoami.akamai.net',
    'whoami.ds.akahelp.net',
    'pxlk9.net.', // This one is malformed from EasyList, which I will manually add instead
    'instant.page', // No, it doesn't violate anyone's privacy. I will whitelist it
    'piwik.pro',
    'mixpanel.com',
    'heapanalytics.com',
    'dataunlocker.com',
    'segment.com',
    'segment.io',
    'segmentify.com'
  ]);

  (await Promise.all([
    // Easy List
    'https://easylist.to/easylist/easylist.txt',
    // AdGuard DNS Filter
    'https://adguardteam.github.io/AdGuardSDNSFilter/Filters/filter.txt',
    // uBlock Origin Filter List
    'https://ublockorigin.github.io/uAssetsCDN/filters/filters.txt',
    'https://ublockorigin.github.io/uAssetsCDN/filters/filters-2020.txt',
    'https://ublockorigin.github.io/uAssetsCDN/filters/filters-2021.txt',
    'https://ublockorigin.github.io/uAssetsCDN/filters/filters-2022.txt',
    // uBlock Origin Badware Risk List
    'https://ublockorigin.github.io/uAssets/filters/badware.txt',
    // uBlock Origin Privacy List
    'https://ublockorigin.github.io/uAssets/filters/privacy.txt',
    // uBlock Origin Resource Abuse
    'https://ublockorigin.github.io/uAssets/filters/resource-abuse.txt',
    // uBlock Origin Unbreak
    'https://ublockorigin.github.io/uAssets/filters/unbreak.txt',
    // AdGuard Base Filter
    'https://filters.adtidy.org/extension/ublock/filters/2_without_easylist.txt',
    // AdGuard Mobile AD
    'https://filters.adtidy.org/extension/ublock/filters/11.txt',
    // AdGuard Tracking Protection
    'https://filters.adtidy.org/extension/ublock/filters/3.txt',
    // AdGuard Japanese filter
    'https://filters.adtidy.org/extension/ublock/filters/7.txt',
    // AdGuard Chinese filter (EasyList China + AdGuard Chinese filter)
    'https://filters.adtidy.org/extension/ublock/filters/224.txt',
    // Easy Privacy
    'https://easylist.to/easylist/easyprivacy.txt',
    // Curben's Malware Online UrlHaus
    'https://curben.gitlab.io/malware-filter/urlhaus-filter-agh-online.txt',
    // Curben's Phishing Online Filter
    'https://curben.gitlab.io/malware-filter/phishing-filter-agh.txt',
    // Curben's PUP List
    'https://curben.gitlab.io/malware-filter/pup-filter-agh.txt',
    // GameConsoleAdblockList
    'https://raw.githubusercontent.com/DandelionSprout/adfilt/master/GameConsoleAdblockList.txt',
    // PiHoleBlocklist
    'https://raw.githubusercontent.com/Perflyst/PiHoleBlocklist/master/SmartTV-AGH.txt',
  ].map(processFilterRules))).forEach(({ white, black }) => {
    white.forEach(i => filterRuleWhitelistDomainSets.add(i));
    black.forEach(i => domainSets.add(i));
  });

  const adguardSize = domainSets.size - hostsSize - sukkaSize;
  console.log(`Import ${adguardSize} rules from adguard filters!`);

  // Read DOMAIN Keyword
  const domainKeywordsSet = new Set();
  const domainSuffixSet = new Set();
  await fsPromises.readFile(pathResolve(__dirname, '../List/non_ip/reject.conf'), { encoding: 'utf-8' }).then(data => {
    data.split('\n').forEach(line => {
      if (line.startsWith('DOMAIN-KEYWORD')) {
        const [, ...keywords] = line.split(',');
        domainKeywordsSet.add(keywords.join(',').trim());
      } else if (line.startsWith('DOMAIN-SUFFIX')) {
        const [, ...keywords] = line.split(',');
        domainSuffixSet.add(keywords.join(',').trim());
      }
    });
  });

  console.log(`Import ${domainKeywordsSet.size} black keywords and ${domainSuffixSet.size} black suffixes!`);

  const beforeDeduping = domainSets.size;
  // Dedupe domainSets
  console.log(`Start deduping! (${beforeDeduping})`);

  const piscina = new Piscina({
    filename: pathResolve(__dirname, 'worker/build-reject-domainset-worker.js')
  });

  (await Promise.all([
    piscina.run(
      { keywords: domainKeywordsSet, suffixes: domainSuffixSet, input: domainSets },
      { name: 'dedupeKeywords' }
    ),
    piscina.run(
      { whiteList: filterRuleWhitelistDomainSets, input: domainSets },
      { name: 'whitelisted' }
    )
  ])).forEach(set => {
    set.forEach(i => domainSets.delete(i));
  });

  const originalFullSet = new Set([...domainSets]);

  (await Promise.all(
    Array.from(domainSets)
      .reduce((result, element, index) => {
        const chunk = index % threads;
        result[chunk] ??= [];

        result[chunk].push(element);
        return result;
      }, [])
      .map(chunk => piscina.run(
        { input: chunk, fullSet: originalFullSet },
        { name: 'dedupe' }
      ))
  )).forEach(set => {
    set.forEach(i => domainSets.delete(i));
  });

  console.log(`Deduped ${beforeDeduping - domainSets.size} rules!`);

  return fsPromises.writeFile(
    pathResolve(__dirname, '../List/domainset/reject.conf'),
    `${[...domainSets].join('\n')}\n`,
    { encoding: 'utf-8' });
})();
