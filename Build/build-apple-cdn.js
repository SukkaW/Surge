const { fetchWithRetry } = require('./lib/fetch-retry');
const fs = require('fs');
const path = require('path');

const rDomain = /^(((?!\-))(xn\-\-)?[a-z0-9\-_]{0,61}[a-z0-9]{1,1}\.)*(xn\-\-)?([a-z0-9\-]{1,61}|[a-z0-9\-]{1,30})\.[a-z]{2,}$/m;

(async () => {
  console.time('Total Time - build-apple-cdn-conf');

  const res = (await (await fetchWithRetry('https://raw.githubusercontent.com/felixonmars/dnsmasq-china-list/master/apple.china.conf')).text())
    .split('\n')
    .map(line => {
      if (line.startsWith('server=/') && line.endsWith('/114.114.114.114')) {
        return line.replace('server=/', '').replace('/114.114.114.114', '');
      }

      return null
    })
    .filter(domain => typeof domain === 'string' && rDomain.test(domain));

  await Promise.all([
    fs.promises.writeFile(
      path.resolve(__dirname, '../List/non_ip/apple_cdn.conf'),
      res.map(domain => `DOMAIN-SUFFIX,${domain}`).join('\n') + '\n',
      'utf-8'
    ),
    fs.promises.writeFile(
      path.resolve(__dirname, '../List/domainset/apple_cdn.conf'),
      res.map(i => `.${i}`).join('\n') + '\n',
      'utf-8'
    )
  ])

  console.timeEnd('Total Time - build-apple-cdn-conf');
})();
