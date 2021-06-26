const https = require('https');

let ALEXA_TOP_LIMIT = 10000;

let unzip, csv2, es;

try {
  unzip = require('unzip-stream');
  csv2 = require('csv2');
  es = require('event-stream');
} catch (e) {
  console.log('Dependencies not found');
  console.log('"npm i unzip-stream event-stream csv2" then try again!');

  console.error(e);
  process.exit(1);
}

(async () => {
  const alexaTopDomains = (await fetchAlexaTopDomains()).sort();
  const dnsmasqconfDomains = await fetchAndParseDnsmasqDomains(alexaTopDomains);

  console.log(dnsmasqconfDomains.length);
})();

function fetchAlexaTopDomains() {
  const data = [];

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 's3.amazonaws.com',
        path: '/alexa-static/top-1m.csv.zip',
        method: 'GET',
      },
      (res) => {
        res
          .pipe(unzip.Parse())
          .on('entry', (entry) => {
            entry.pipe(csv2()).on('data', ([top, domain]) => {
              if (top < ALEXA_TOP_LIMIT) {
                data.push(domain);
              }
            });
          });

        res.on('end', () => {
          try {
            resolve(data);
          } catch (e) {
            reject(e);
          }
        });
        req.on('error', (err) => {
          reject(err);
        });
      }
    );

    req.end();
  })
}

function fetchAndParseDnsmasqDomains(alexaTopDomains) {
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
          .pipe(es.mapSync(line => {
            s.pause();

            const domain = line
              .replaceAll('server=/', '')
              .replaceAll('/114.114.114.114', '');

            if (alexaTopDomains.includes(domain)) {
              console.log(domain);
              data.push(domain);
            }

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
