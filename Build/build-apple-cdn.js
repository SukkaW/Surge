const path = require('path');

const { compareAndWriteFile } = require('./lib/string-array-compare');
const { withBannerArray } = require('./lib/with-banner');

const { parseFelixDnsmasq } = require('./lib/parse-dnsmasq');

(async () => {
  console.time('Total Time - build-apple-cdn-conf');

  const res = await parseFelixDnsmasq('https://raw.githubusercontent.com/felixonmars/dnsmasq-china-list/master/apple.china.conf');

  await Promise.all([
    compareAndWriteFile(
      withBannerArray(
        'Sukka\'s Surge Rules - Apple CDN',
        [
          'License: AGPL 3.0',
          'Homepage: https://ruleset.skk.moe',
          'GitHub: https://github.com/SukkaW/Surge',
          '',
          'This file contains Apple\'s domains using their China mainland CDN servers.',
          '',
          'Data from:',
          ' - https://github.com/felixonmars/dnsmasq-china-list'
        ],
        new Date(),
        res.map(domain => `DOMAIN-SUFFIX,${domain}`)
      ),
      path.resolve(__dirname, '../List/non_ip/apple_cdn.conf')
    ),
    compareAndWriteFile(
      withBannerArray(
        'Sukka\'s Surge Rules - Apple CDN',
        [
          'License: AGPL 3.0',
          'Homepage: https://ruleset.skk.moe',
          'GitHub: https://github.com/SukkaW/Surge',
          '',
          'This file contains Apple\'s domains using their China mainland CDN servers.',
          '',
          'Data from:',
          ' - https://github.com/felixonmars/dnsmasq-china-list'
        ],
        new Date(),
        res.map(i => `.${i}`)
      ),
      path.resolve(__dirname, '../List/domainset/apple_cdn.conf')
    )
  ]);

  console.timeEnd('Total Time - build-apple-cdn-conf');
})();
