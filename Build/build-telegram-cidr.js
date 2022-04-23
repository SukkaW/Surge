const { fetch } = require('undici');
const fs = require('fs');
const path = require('path');

(async () => {
  const resp = await fetch('https://core.telegram.org/resources/cidr.txt');
  const lastModified = new Date(resp.headers.get('last-modified'));

  const res = (await resp.text())
    .split('\n')
    .filter(line => line.trim() !== '');

  await fs.promises.writeFile(
    path.resolve(__dirname, '../List/ip/telegram.conf'),
    '# Telegram CIDR (https://core.telegram.org/resources/cidr.txt)' + '\n' +
    '# Last Updated: ' + lastModified.toISOString() + '\n' +
    res.map(ip => {
      return ip.includes(':')
        ? `IP-CIDR6,${ip},no-resolve`
        : `IP-CIDR,${ip},no-resolve`;
    }).join('\n') + '\n',
    'utf-8'
  );
})();
