const { fetchWithRetry } = require('./lib/fetch-retry');
const fs = require('fs');
const path = require('path');
const { isIPv4, isIPv6 } = require('net');
const { withBanner } = require('./lib/with-banner');

(async () => {
  console.time('Total Time - build-telegram-cidr');

  /** @type {Response} */
  const resp = await fetchWithRetry('https://core.telegram.org/resources/cidr.txt');
  const lastModified = resp.headers.get('last-modified');
  const date = lastModified ? new Date(lastModified) : new Date();

  const res = (await resp.text())
    .split('\n')
    .filter(line => line.trim() !== '');

  if (res.length === 0) {
    throw new Error('Failed to fetch data!');
  }

  await fs.promises.writeFile(
    path.resolve(__dirname, '../List/ip/telegram.conf'),
    withBanner(
      'Sukka\'s Surge Rules - Telegram IP CIDR',
      [
        'License: AGPL 3.0',
        'Homepage: https://ruleset.skk.moe',
        'GitHub: https://github.com/SukkaW/Surge',
        'Data from:',
        ' - https://core.telegram.org/resources/cidr.txt'
      ],
      date,
      res.map(ip => {
        const [subnet] = ip.split('/');
        console.log('  - ' + ip + ': ' + subnet);
        if (isIPv4(subnet)) {
          return `IP-CIDR,${ip},no-resolve`;
        }
        if (isIPv6(subnet)) {
          return `IP-CIDR6,${ip},no-resolve`;
        }
        return '';
      })
    )
  )

  console.timeEnd('Total Time - build-telegram-cidr');
})();
