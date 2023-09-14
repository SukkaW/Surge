const tldts = require('tldts');
const { processFilterRules } = require('./lib/parse-filter.js');
const path = require('path');
const { createRuleset } = require('./lib/create-file');
const { processLine } = require('./lib/process-line.js');
const domainSorter = require('./lib/stable-sort-domain');
const { runner, traceSync } = require('./lib/trace-runner.js');

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
  'cfd',
  'fit',
  'mobi',
  'buzz',
  'one',
  'com.cn'
]);

const buildPhishingDomainSet = async () => {
  const domainSet = Array.from((await processFilterRules('https://curbengh.github.io/phishing-filter/phishing-filter-agh.txt')).black);
  const domainCountMap = {};

  for (let i = 0, len = domainSet.length; i < len; i++) {
    const line = processLine(domainSet[i]);
    if (!line) continue;

    const parsed = tldts.parse(line, { allowPrivateDomains: true });
    const apexDomain = parsed.domain;

    if (apexDomain) {
      if (WHITELIST_DOMAIN.has(apexDomain)) {
        continue;
      }

      domainCountMap[apexDomain] ||= 0;

      let isPhishingDomainMockingAmazon = false;
      if (line.startsWith('.amaz')) {
        domainCountMap[apexDomain] += 0.5;

        isPhishingDomainMockingAmazon = true;

        if (line.startsWith('.amazon-')) {
          domainCountMap[apexDomain] += 4.5;
        }
      } else if (line.startsWith('.customer')) {
        domainCountMap[apexDomain] += 0.25;
      }
      if (line.includes('-co-jp')) {
        domainCountMap[apexDomain] += (isPhishingDomainMockingAmazon ? 4.5 : 0.5);
      }

      const tld = parsed.publicSuffix;
      if (!tld || !BLACK_TLD.has(tld)) continue;

      domainCountMap[apexDomain] += 1;

      if (line.length > 19) {
        // Add more weight if the domain is long enough
        if (line.length > 44) {
          domainCountMap[apexDomain] += 3.5;
        } else if (line.length > 34) {
          domainCountMap[apexDomain] += 2.5;
        } else if (line.length > 29) {
          domainCountMap[apexDomain] += 1.5;
        } else if (line.length > 24) {
          domainCountMap[apexDomain] += 0.75;
        } else if (line.length > 19) {
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

  const results = traceSync('* get final results', () => Object.entries(domainCountMap)
    .reduce((acc, [apexDomain, count]) => {
      if (count >= 5) {
        acc.push(`.${apexDomain}`);
      }
      return acc;
    }, /** @type {string[]} */([]))
    .sort(domainSorter));

  const description = [
    'License: AGPL 3.0',
    'Homepage: https://ruleset.skk.moe',
    'GitHub: https://github.com/SukkaW/Surge',
    '',
    'The domainset supports enhanced phishing protection',
    'Build from:',
    ' - https://gitlab.com/malware-filter/phishing-filter'
  ];

  await Promise.all(createRuleset(
    'Sukka\'s Ruleset - Reject Phishing',
    description,
    new Date(),
    results,
    'domainset',
    path.resolve(__dirname, '../List/domainset/reject_phishing.conf'),
    path.resolve(__dirname, '../Clash/domainset/reject_phishing.txt')
  ));
};

module.exports.buildPhishingDomainSet = buildPhishingDomainSet;

if (require.main === module) {
  runner(__filename, buildPhishingDomainSet);
}
