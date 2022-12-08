const { fetchWithRetry } = require('./lib/fetch-retry');
const { withBannerArray } = require('./lib/with-banner');
const { resolve: pathResolve } = require('path');
const { compareAndWriteFile } = require('./lib/string-array-compare');

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

  await compareAndWriteFile(
    withBannerArray(
      'Sukka\'s Surge Rules - Mainland China IPv4 CIDR',
      [
        'License: CC BY-SA 2.0',
        'Homepage: https://ruleset.skk.moe',
        'GitHub: https://github.com/SukkaW/Surge',
        '',
        'Data from https://misaka.io (misakaio @ GitHub)',
      ],
      new Date(),
      filteredCidr.map(i => `IP-CIDR,${i}`)
    ),
    pathResolve(__dirname, '../List/ip/china_ip.conf')
  )

  console.timeEnd('Total Time - build-chnroutes-cidr');
})();
