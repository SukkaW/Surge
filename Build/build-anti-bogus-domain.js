const { fetchWithRetry } = require('./lib/fetch-retry');
const fs = require('fs');
const path = require('path');
const { isIPv4, isIPv6 } = require('net');
const { compareAndWriteFile } = require('./lib/string-array-compare');
const { withBannerArray } = require('./lib/with-banner');

(async () => {
  console.time('Total Time - build-anti-bogus-domain');
  console.time('* Download bogus-nxdomain-list')
  const res = (await (await fetchWithRetry('https://raw.githubusercontent.com/felixonmars/dnsmasq-china-list/master/bogus-nxdomain.china.conf')).text())
    .split('\n')
    .map(line => {
      if (line.startsWith('bogus-nxdomain=')) {
        return line.replace('bogus-nxdomain=', '');
      }

      return null
    })
    .filter(ip => typeof ip === 'string');

  console.timeEnd('* Download bogus-nxdomain-list')

  const filePath = path.resolve(__dirname, '../Source/ip/reject.conf');
  const resultPath = path.resolve(__dirname, '../List/ip/reject.conf');
  const content = (await fs.promises.readFile(filePath, 'utf-8'))
    .replace(
      '# --- [Anti Bogus Domain Replace Me] ---',
      res.map(ip => {
        if (isIPv4(ip)) {
          return `IP-CIDR,${ip}/32,no-resolve`
        }
        if (isIPv6(ip)) {
          return `IP-CIDR6,${ip}/128,no-resolve`
        }
        return ''
      }).join('\n')
    );

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
      content.split('\n')
    ),
    resultPath
  )

  console.timeEnd('Total Time - build-anti-bogus-domain');
})();
