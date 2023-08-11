// @ts-check
const path = require('path');
const { isIPv4, isIPv6 } = require('net');
const { compareAndWriteFile } = require('./lib/string-array-compare');
const { withBannerArray } = require('./lib/with-banner');
const { fetchRemoteTextAndCreateReadlineInterface, readFileByLine } = require('./lib/fetch-remote-text-by-line');
const { minifyRules } = require('./lib/minify-rules');

(async () => {
  console.time('Total Time - build-anti-bogus-domain');
  console.time('* Download bogus-nxdomain-list');

  /** @type {string[]} */
  const res = [];
  for await (const line of await fetchRemoteTextAndCreateReadlineInterface('https://raw.githubusercontent.com/felixonmars/dnsmasq-china-list/master/bogus-nxdomain.china.conf')) {
    if (line.startsWith('bogus-nxdomain=')) {
      res.push(line.replace('bogus-nxdomain=', ''));
    }
  }

  console.timeEnd('* Download bogus-nxdomain-list');

  const filePath = path.resolve(__dirname, '../Source/ip/reject.conf');
  const resultPath = path.resolve(__dirname, '../List/ip/reject.conf');

  /** @type {string[]} */
  const result = [];
  for await (const line of readFileByLine(filePath)) {
    if (line === '# --- [Anti Bogus Domain Replace Me] ---') {
      res.forEach(ip => {
        if (isIPv4(ip)) {
          result.push(`IP-CIDR,${ip}/32,no-resolve`);
        } else if (isIPv6(ip)) {
          result.push(`IP-CIDR6,${ip}/128,no-resolve`);
        }
      });
    } else {
      result.push(line);
    }
  }

  await compareAndWriteFile(
    withBannerArray(
      'Sukka\'s Surge Rules - Anti Bogus Domain',
      [
        'License: AGPL 3.0',
        'Homepage: https://ruleset.skk.moe',
        'GitHub: https://github.com/SukkaW/Surge',
        '',
        'This file contains known addresses that are hijacking NXDOMAIN results returned by DNS servers.',
        '',
        'Data from:',
        ' - https://github.com/felixonmars/dnsmasq-china-list'
      ],
      new Date(),
      minifyRules(result)
    ),
    resultPath
  );

  console.timeEnd('Total Time - build-anti-bogus-domain');
})();
