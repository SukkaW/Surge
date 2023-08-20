const { parse } = require('tldts');
const { processFilterRules } = require('./lib/parse-filter.js');
const path = require('path');
const { withBannerArray } = require('./lib/with-banner.js');
const { compareAndWriteFile } = require('./lib/string-array-compare');
const { processLine } = require('./lib/process-line.js');
const domainSorter = require('./lib/stable-sort-domain');

const WHITELIST_DOMAIN = new Set([
  'w3s.link',
  'dweb.link',
  'nftstorage.link',
  'square.site',
  'business.site',
  'page.link', // Firebase URL Shortener
  'fleek.cool',
  'notion.site'
]);
const BLACK_TLD = new Set([
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
  'codes',
  'cloud',
  'club',
  'click',
  'cfd'
]);

(async () => {
  const domainSet = Array.from(
    (
      await processFilterRules('https://curbengh.github.io/phishing-filter/phishing-filter-agh.txt')
    ).black
  );
  const domainCountMap = {};

  for (let i = 0, len = domainSet.length; i < len; i++) {
    const line = processLine(domainSet[i]);
    if (!line) continue;

    const domain = line.charCodeAt(0) === 46 ? line.slice(1) : line;

    const parsed = parse(domain, { allowPrivateDomains: true });

    const apexDomain = parsed.domain;

    if (apexDomain) {
      if (WHITELIST_DOMAIN.has(apexDomain)) {
        continue;
      }

      domainCountMap[apexDomain] ||= 0;

      let isPhishingDomainMockingAmazon = false;

      if (domain.startsWith('amaz')) {
        domainCountMap[apexDomain] += 0.5;

        isPhishingDomainMockingAmazon = true;

        if (domain.startsWith('amazon-')) {
          domainCountMap[apexDomain] += 4.5;
        }
      } else if (domain.startsWith('customer')) {
        domainCountMap[apexDomain] += 0.25;
      }
      if (domain.includes('-co-jp')) {
        domainCountMap[apexDomain] += (isPhishingDomainMockingAmazon ? 4.5 : 0.5);
      }

      const tld = parsed.publicSuffix;
      if (!tld || !BLACK_TLD.has(tld)) continue;

      domainCountMap[apexDomain] += 1;

      if (domain.length > 19) {
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
          const subdomain = parsed.subdomain;
          if (subdomain && subdomain.includes('.')) {
            domainCountMap[apexDomain] += 1.5;
          }
        }
      }
    }
  }

  const results = [];

  console.log(domainCountMap['serveusers.com']);
  Object.entries(domainCountMap).forEach(([domain, count]) => {
    if (
      count >= 5
    ) {
      results.push(`.${domain}`);
    }
  });

  results.sort(domainSorter);

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
  );
})();
