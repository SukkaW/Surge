const { fetchWithRetry } = require('./lib/fetch-retry');
const fs = require('fs');
const path = require('path');
const { isIP } = require('net');

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
    .filter(ip => typeof ip === 'string' && isIP(ip) !== 0);
  console.timeEnd('* Download bogus-nxdomain-list')

  const filePath = path.resolve(__dirname, '../List/ip/reject.conf');
  const content = (await fs.promises.readFile(filePath, 'utf-8'))
    .replace(
      '# --- [Anti Bogus Domain Replace Me] ---',
      res.map(ip => `IP-CIDR,${ip}/32,no-resolve`).join('\n')
    );

  await fs.promises.writeFile(filePath, content, 'utf-8');
  console.timeEnd('Total Time - build-anti-bogus-domain');
})();
