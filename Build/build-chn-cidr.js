const { fetchWithRetry } = require('./lib/fetch-retry');
const { withBanner } = require('./lib/with-banner');
const { promises: fsPromises } = require('fs');
const { resolve: pathResolve } = require('path');

(async () => {
  console.time('Total Time - build-chnroutes-cidr');

  const [rawCidr, { merge: mergeCidrs }] = await Promise.all([
    (await fetchWithRetry('https://raw.githubusercontent.com/misakaio/chnroutes2/master/chnroutes.txt')).text(),
    import('cidr-tools')
  ]);
  const cidr = rawCidr.split('\n');

  console.log('Before Merge:', cidr.length);
  const filteredCidr = mergeCidrs(cidr.filter(line => {
    if (line) {
      return !line.startsWith('#')
    }

    return false;
  }));
  console.log('After Merge:', filteredCidr.length);

  await fsPromises.writeFile(pathResolve(__dirname, '../List/ip/china_ip.conf'), makeCidrList(filteredCidr), { encoding: 'utf-8' });

  console.timeEnd('Total Time - build-chnroutes-cidr');
})();

function makeCidrList(cidr) {
  const date = new Date();

  return withBanner(
    'Mainland China IPv4 CIDR',
    ['Data from misaka.io (misakaio @ GitHub)', 'License: CC BY-SA 2.0'],
    date,
    cidr.map(i => `IP-CIDR,${i}`)
  );
};
