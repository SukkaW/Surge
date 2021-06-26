const https = require('https');
const { promises: fsPromises } = require('fs');
const { resolve: pathResolve } = require('path');

let cidrTools;

try {
  cidrTools = require('cidr-tools');
} catch (e) {
  console.log('Dependency "cidr-tools" not found');
  console.log('"npm i cidr-tools" then try again!');
  process.exit(1);
}

(async () => {
  const cidr = (await get('raw.githubusercontent.com', '/tmplink/IPDB/main/ipv4/cidr/CN.txt')).split('\n');

  let FILTER_FLAG = false;
  const filteredCidr = cidr.filter(Boolean).filter((ip, index) => {
    if (FILTER_FLAG) return false;

    const prev = cidr[index - 1];
    const next = cidr[index + 1];
    const prevA = Number(prev?.split('.')[0]);
    const nextA = Number(next?.split('.')[0]);

    if (
      prevA >= 223 // MCAST-TEST-NET
      && nextA < 10
      && prevA > nextA
    ) {
      FILTER_FLAG = true;
      return false;
    }

    return true;
  });

  const mergedCidr = cidrTools.merge(filteredCidr);

  if (mergedCidr.length < 4500) {
    console.log(`Merged routes (which is ${mergedCidr.length}) is less than 5000 routes, which can't be right. Aborted`);
    process.exit(1);
  }

  return fsPromises.writeFile(pathResolve(__dirname, '../List/ip/china_ip.conf'), makeCidrList(mergedCidr), { encoding: 'utf-8' });
})();

function makeCidrList(cidr) {
  const date = new Date();

  return `############################
# Mainland China IPv4 CIDR
# Data from vx.link (tmplink @ GitHub)
# Last Updated: ${date.getFullYear()}-${date.getUTCMonth() + 1}-${date.getUTCDate()} ${date.getUTCHours()}:${date.getUTCMinutes()}:${date.getUTCSeconds()}
# Routes: ${cidr.length}
############################\n` + cidr.map(i => `IP-CIDR,${i}`).join('\n') + '\n########### END ############\n';
};

function get(hostname, path) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname,
        path,
        method: 'GET',
      },
      (res) => {
        const body = [];
        res.on('data', (chunk) => {
          body.push(chunk);
        });
        res.on('end', () => {
          try {
            resolve(String(Buffer.concat(body)));
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
  });
}
