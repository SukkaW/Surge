const tldts = require('tldts');
const { processFilterRules } = require('./lib/parse-filter.js');
const fs = require('fs');
const path = require('path');

const WHITELIST_DOMAIN = new Set([
  'w3s.link',
  'dweb.link',
  'nftstorage.link'
]);
const BLACK_TLD = Array.from(new Set([
  '.xyz',
  '.top',
  '.win',
  '.vip',
  '.site',
  '.space',
  '.online',
  '.icu',
  '.fun',
  '.shop',
  '.cool',
  '.cyou',
  '.id',
  '.pro',
  '.za.com',
  '.sa.com',
  '.ltd',
  '.group',
  '.rest',
  '.tech',
  '.link',
  '.ink',
  '.bar',
  '.tokyo'
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

        domainCountMap[apexDomain] ||= 0;
        domainCountMap[apexDomain] += 1;

        // Add more weight if the domain is long enough
        if (domain.length > 45) {
          domainCountMap[apexDomain] += 1;
        } else if (domain.length > 35) {
          domainCountMap[apexDomain] += 0.5;
        }
      }
    }
  }

  const results = [];
  Object.entries(domainCountMap).forEach(([domain, count]) => {
    if (
      count >= 5
      && BLACK_TLD.some(tld => domain.endsWith(tld))
    ) {
      results.push('.' + domain);
    }
  });

  const filePath = path.resolve(__dirname, '../List/domainset/reject_phishing.conf');
  await fs.promises.writeFile(filePath, results.join('\n') + '\n', 'utf-8');
})();
