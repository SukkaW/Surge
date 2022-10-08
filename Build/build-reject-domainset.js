const { promises: fsPromises } = require('fs');
const { resolve: pathResolve } = require('path');
const Piscina = require('piscina');
const { processHosts, processFilterRules, preprocessFullDomainSetBeforeUsedAsWorkerData } = require('./lib/parse-filter');
const cpuCount = require('os').cpus().length;
const { isCI } = require('ci-info');
const threads = isCI ? cpuCount : cpuCount / 2;

(async () => {
  console.time('Total Time - build-reject-domain-set');

  /** @type Set<string> */
  const domainSets = new Set();

  console.log('Downloading hosts file...');
  console.time('* Download and process Hosts');

  // Parse from remote hosts & domain lists
  (await Promise.all([
    processHosts('https://pgl.yoyo.org/adservers/serverlist.php?hostformat=hosts&showintro=0&mimetype=plaintext', true),
    processHosts('https://raw.githubusercontent.com/hoshsadiq/adblock-nocoin-list/master/hosts.txt'),
    processHosts('https://raw.githubusercontent.com/crazy-max/WindowsSpyBlocker/master/data/hosts/spy.txt')
  ])).forEach(hosts => {
    hosts.forEach(host => {
      if (host) {
        domainSets.add(host);
      }
    });
  });

  console.timeEnd('* Download and process Hosts');

  let previousSize = domainSets.size;
  console.log(`Import ${previousSize} rules from hosts files!`);

  await fsPromises.readFile(pathResolve(__dirname, '../List/domainset/reject_sukka.conf'), { encoding: 'utf-8' }).then(data => {
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

      /* if (domainSets.has(line) || domainSets.has(`.${line}`)) {
        console.warn(`|${line}| is already in the list!`);
      } */
      domainSets.add(trimmed);
    });
  });

  previousSize = domainSets.size - previousSize;
  console.log(`Import ${previousSize} rules from reject_sukka.conf!`);

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
    'skk.moe',
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
    'cdn.mxpnl.com',
    'heapanalytics.com',
    'segment.com',
    'segmentify.com',
    't.co', // pgl yoyo add t.co to the blacklist
    'survicate.com', // AdGuardDNSFilter
    'perfops.io', // AdGuardDNSFilter
    'd2axgrpnciinw7.cloudfront.net', // ADGuardDNSFilter
    'tb-lb.sb-cd.com', // AdGuard
    'storage.yandexcloud.net' // phishing list
  ]);

  console.time('* Download and process AdBlock Filter Rules');
  (await Promise.all([
    // Easy List
    [
      'https://easylist.to/easylist/easylist.txt',
      [
        'https://easylist-downloads.adblockplus.org/easylist.txt',
        'https://raw.githubusercontent.com/easylist/easylist/gh-pages/easylist.txt',
        'https://secure.fanboy.co.nz/easylist.txt'
      ]
    ],
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
    [
      'https://easylist.to/easylist/easyprivacy.txt',
      [
        'https://secure.fanboy.co.nz/easyprivacy.txt',
        'https://raw.githubusercontent.com/easylist/easylist/gh-pages/easyprivacy.txt',
        'https://easylist-downloads.adblockplus.org/easyprivacy.txt'
      ]
    ],
    // Curben's Malware Online UrlHaus
    'https://malware-filter.gitlab.io/malware-filter/urlhaus-filter-agh-online.txt',
    // Curben's Phishing Online Filter
    'https://malware-filter.gitlab.io/malware-filter/phishing-filter-agh.txt',
    // Curben's PUP List
    'https://malware-filter.gitlab.io/malware-filter/pup-filter-agh.txt',
    // GameConsoleAdblockList
    'https://raw.githubusercontent.com/DandelionSprout/adfilt/master/GameConsoleAdblockList.txt',
    // PiHoleBlocklist
    'https://raw.githubusercontent.com/Perflyst/PiHoleBlocklist/master/SmartTV-AGH.txt',
    // Spam404
    'https://raw.githubusercontent.com/Spam404/lists/master/adblock-list.txt'
  ].map(input => {
    if (typeof input === 'string') {
      return processFilterRules(input);
    }
    if (Array.isArray(input) && input.length === 2) {
      return processFilterRules(input[0], input[1]);
    }
  }))).forEach(({ white, black }) => {
    white.forEach(i => filterRuleWhitelistDomainSets.add(i));
    black.forEach(i => domainSets.add(i));
  });

  console.timeEnd('* Download and process AdBlock Filter Rules');

  previousSize = domainSets.size - previousSize;
  console.log(`Import ${previousSize} rules from adguard filters!`);

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

  previousSize = domainSets.size;
  // Dedupe domainSets
  console.log(`Start deduping from black keywords/suffixes! (${previousSize})`);
  console.time(`* Dedupe from black keywords/suffixes`);

  const toBeRemoved = new Set();
  for (const domain of domainSets) {
    let isTobeRemoved = false;

    for (const keyword of domainKeywordsSet) {
      if (domain.includes(keyword) || keyword.includes(domain)) {
        isTobeRemoved = true;
        break;
      }
    }

    if (!isTobeRemoved) {
      for (const suffix of domainSuffixSet) {
        if (domain.endsWith(suffix)) {
          isTobeRemoved = true;
          break;
        }
      }
    }

    if (!isTobeRemoved) {
      for (const white of filterRuleWhitelistDomainSets) {
        if (domain.includes(white) || white.includes(domain)) {
          isTobeRemoved = true;
          break;
        }
      }
    }

    if (isTobeRemoved) {
      toBeRemoved.add(domain);
    }
  }

  toBeRemoved.forEach((removed) => {
    domainSets.delete(removed)
  });

  console.timeEnd(`* Dedupe from black keywords/suffixes`);
  console.log(`Deduped ${previousSize} - ${domainSets.size} = ${previousSize - domainSets.size} from black keywords and suffixes!`);

  previousSize = domainSets.size;
  // Dedupe domainSets
  console.log(`Start deduping! (${previousSize})`);

  const START_TIME = Date.now();

  const piscina = new Piscina({
    filename: pathResolve(__dirname, 'worker/build-reject-domainset-worker.js'),
    workerData: preprocessFullDomainSetBeforeUsedAsWorkerData([...domainSets]),
    idleTimeout: 50,
    minThreads: threads,
    maxThreads: threads
  });

  console.log(`Launching ${threads} threads...`)

  const tasksArray = Array.from(domainSets)
    .reduce((result, element, index) => {
      const chunk = index % threads;
      result[chunk] ??= [];

      result[chunk].push(element);
      return result;
    }, []);

  (
    await Promise.all(
      Array.from(domainSets)
        .reduce((result, element, index) => {
          const chunk = index % threads;
          result[chunk] ??= [];
          result[chunk].push(element);
          return result;
        }, [])
        .map(chunk => piscina.run({ chunk }, { name: 'dedupe' }))
    )
  ).forEach((result, taskIndex) => {
    const chunk = tasksArray[taskIndex];
    result.forEach((value, index) => {
      if (value === 1) {
        domainSets.delete(chunk[index])
      }
    })
  });

  console.log(`* Dedupe from covered subdomain - ${(Date.now() - START_TIME) / 1000}s`);
  console.log(`Deduped ${previousSize - domainSets.size} rules!`);

  await Promise.all([
    fsPromises.writeFile(
      pathResolve(__dirname, '../List/domainset/reject.conf'),
      `${[...domainSets].join('\n')}\n`,
      { encoding: 'utf-8' }
    ),
    piscina.destroy()
  ]);

  console.timeEnd('Total Time - build-reject-domain-set');
  if (piscina.queueSize === 0) {
    process.exit(0);
  }
})();
