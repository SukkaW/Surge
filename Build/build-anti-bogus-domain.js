const { fetchWithRetry } = require('./lib/fetch-retry');
const fs = require('fs');
const path = require('path');
const { isIPv4, isIPv6 } = require('net');

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

  await fs.promises.writeFile(resultPath, content, 'utf-8');
  console.timeEnd('Total Time - build-anti-bogus-domain');
})();
