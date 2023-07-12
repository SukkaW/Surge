const tldts = require('tldts');
const { processFilterRules } = require('./lib/parse-filter.js');
const path = require('path');
const { withBannerArray } = require('./lib/with-banner.js');
const { compareAndWriteFile } = require('./lib/string-array-compare');

const WHITELIST_DOMAIN = new Set([
  'w3s.link',
  'dweb.link',
  'nftstorage.link',
  'square.site',
  'business.site',
  'page.link', // Firebase URL Shortener
  'fleek.cool'
]);
const BLACK_TLD = Array.from(new Set([
  'xyz',
  'top',
  'win',
  'vip',
  'site',
  'space',
  'online',
  'icu',
  'fun',
  'shop',
  'cool',
  'cyou',
  'id',
  'pro',
  'za.com',
  'sa.com',
  'ltd',
  'group',
  'rest',
  'tech',
  'link',
  'ink',
  'bar',
  'tokyo',
  'tk',
  'cf',
  'gq',
  'ga',
  'ml',
  'cc',
  'cn',
  'codes'
]));

(async () => {
  const domainSet = Array.from(
    (
      await processFilterRules('https://curbengh.github.io/phishing-filter/phishing-filter-agh.txt')
    ).black
  );
  const domainCountMap = {};

  for (let i = 0, len = domainSet.length; i < len; i++) {
    const line = domainSet[i];
    // starts with #
    if (line.charCodeAt(0) === 35) {
      continue;
    }
    if (line.trim().length === 0) {
      continue;
    }

    const domain = line.charCodeAt(0) === 46 ? line.slice(1) : line;

    if (domain.length > 19) {
      const apexDomain = tldts.getDomain(domain, { allowPrivateDomains: true });

      if (apexDomain) {
        if (WHITELIST_DOMAIN.has(apexDomain)) {
          continue;
        }

        const tld = tldts.getPublicSuffix(domain, { allowPrivateDomains: true });
        if (!tld || !BLACK_TLD.includes(tld)) continue;

        domainCountMap[apexDomain] ||= 0;
        domainCountMap[apexDomain] += 1;

        // Add more weight if the domain is long enough
        if (domain.length > 44) {
          domainCountMap[apexDomain] += 3.5;
        } else if (domain.length > 34) {
          domainCountMap[apexDomain] += 2.5;
        } else if (domain.length > 29) {
          domainCountMap[apexDomain] += 1.5;
        } else if (domain.length > 24) {
          domainCountMap[apexDomain] += 0.75;
        } else if (domain.length > 19) {
          domainCountMap[apexDomain] += 0.25;
        }

        if (domainCountMap[apexDomain] < 5) {
          const subdomain = tldts.getSubdomain(domain, { allowPrivateDomains: true });
          if (subdomain && subdomain.includes('.')) {
            domainCountMap[apexDomain] += 1.5;
          }
        }
      }
    }
  }

  const results = [];
  Object.entries(domainCountMap).forEach(([domain, count]) => {
    if (
      count >= 5
    ) {
      results.push('.' + domain);
    }
  });

  results.sort();

  await compareAndWriteFile(
    withBannerArray(
      'Sukka\'s Surge Rules - Reject Phishing',
      [
        'License: AGPL 3.0',
        'Homepage: https://ruleset.skk.moe',
        'GitHub: https://github.com/SukkaW/Surge',
        '',
        'The domainset supports enhanced phishing protection',
        'Build from:',
        ' - https://gitlab.com/malware-filter/phishing-filter'
      ],
      new Date(),
      results
    ),
    path.resolve(__dirname, '../List/domainset/reject_phishing.conf')
  )
})();
