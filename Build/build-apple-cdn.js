const path = require('path');

const { compareAndWriteFile } = require('./lib/string-array-compare');
const { withBannerArray } = require('./lib/with-banner');

const { parseFelixDnsmasq } = require('./lib/parse-dnsmasq');
const { surgeRulesetToClashClassicalTextRuleset, surgeDomainsetToClashDomainset } = require('./lib/clash');

(async () => {
  console.time('Total Time - build-apple-cdn-conf');

  const res = await parseFelixDnsmasq('https://raw.githubusercontent.com/felixonmars/dnsmasq-china-list/master/apple.china.conf');

  const description = [
    'License: AGPL 3.0',
    'Homepage: https://ruleset.skk.moe',
    'GitHub: https://github.com/SukkaW/Surge',
    '',
    'This file contains Apple\'s domains using their China mainland CDN servers.',
    '',
    'Data from:',
    ' - https://github.com/felixonmars/dnsmasq-china-list'
  ];

  const ruleset = res.map(domain => `DOMAIN-SUFFIX,${domain}`);
  const domainset = res.map(i => `.${i}`);

  await Promise.all([
    compareAndWriteFile(
      withBannerArray(
        'Sukka\'s Ruleset - Apple CDN',
        description,
        new Date(),
        ruleset
      ),
      path.resolve(__dirname, '../List/non_ip/apple_cdn.conf')
    ),
    compareAndWriteFile(
      withBannerArray(
        'Sukka\'s Ruleset - Apple CDN',
        description,
        new Date(),
        surgeRulesetToClashClassicalTextRuleset(ruleset)
      ),
      path.resolve(__dirname, '../Clash/non_ip/apple_cdn.txt')
    ),
    compareAndWriteFile(
      withBannerArray(
        'Sukka\'s Ruleset - Apple CDN',
        description,
        new Date(),
        domainset
      ),
      path.resolve(__dirname, '../List/domainset/apple_cdn.conf')
    ),
    compareAndWriteFile(
      withBannerArray(
        'Sukka\'s Ruleset - Apple CDN',
        description,
        new Date(),
        surgeDomainsetToClashDomainset(domainset)
      ),
      path.resolve(__dirname, '../Clash/domainset/apple_cdn.txt')
    )
  ]);

  console.timeEnd('Total Time - build-apple-cdn-conf');
})();
