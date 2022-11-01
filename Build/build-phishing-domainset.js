const psl = require('psl');
const { processFilterRules } = require('./lib/parse-filter.js');
const fs = require('fs');
const path = require('path');

const WHITELIST_DOMAIN = new Set([]);
const BLACK_TLD = [
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
  '.pro'
];

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

    if (line.length > 25) {
      const parsed = psl.parse(domain);

      if (parsed.input === parsed.tld) {
        continue;
      }
      const apexDomain = parsed.domain

      if (WHITELIST_DOMAIN.has(apexDomain)) {
        continue;
      }

      domainCountMap[apexDomain] ||= 0;
      domainCountMap[apexDomain] += 1;
    }
  }

  const results = [];
  Object.entries(domainCountMap).forEach(([domain, count]) => {
    if (
      count >= 8
      && BLACK_TLD.some(tld => domain.endsWith(tld))
    ) {
      results.push('.' + domain);
    }
  });

  const filePath = path.resolve(__dirname, '../List/domainset/reject_phishing.conf');
  await fs.promises.writeFile(filePath, results.join('\n'), 'utf-8');
})();
