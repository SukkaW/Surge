const https = require('https');

let es;

try {
  es = require('event-stream');
} catch (e) {
  console.log('Dependencies not found');
  console.log('"npm i unzip-stream event-stream csv2" then try again!');

  console.error(e);
  process.exit(1);
}

(async () => {
  const dnsmasqconfDomains = await fetchAndParseDnsmasqDomains();

  console.log(dnsmasqconfDomains.length);
})();

function fetchAndParseDnsmasqDomains() {
  const data = [];

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'raw.githubusercontent.com',
        path: '/felixonmars/dnsmasq-china-list/master/accelerated-domains.china.conf',
        method: 'GET',
      },
      (res) => {
        const s = res
          .pipe(es.split())
          .pipe(es.map(line => {
            s.pause();

            const domain = line
              .replaceAll('server=/', '')
              .replaceAll('/114.114.114.114', '');

            data.push(domain);

            s.resume();
          }))
          .on('error', reject)
          .on('end', () => {
            resolve(data);
          });

        res.on('error', reject);
      }
    );

    req.end();
  })
}
