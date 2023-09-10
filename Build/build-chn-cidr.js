// @ts-check
const { fetchRemoteTextAndCreateReadlineInterface } = require('./lib/fetch-remote-text-by-line');
const { withBannerArray } = require('./lib/with-banner');
const { resolve: pathResolve } = require('path');
const { compareAndWriteFile } = require('./lib/string-array-compare');
const { processLine } = require('./lib/process-line');

// https://github.com/misakaio/chnroutes2/issues/25
const EXCLUDE_CIDRS = [
  '223.118.0.0/15',
  '223.120.0.0/15'
];

(async () => {
  console.time('Total Time - build-chnroutes-cidr');
  const { exclude: excludeCidrs } = await import('cidr-tools-wasm');

  /** @type {Set<string>} */
  const cidr = new Set();
  for await (const line of await fetchRemoteTextAndCreateReadlineInterface('https://raw.githubusercontent.com/misakaio/chnroutes2/master/chnroutes.txt')) {
    const l = processLine(line);
    if (l) {
      cidr.add(l);
    }
  }

  console.log('Before Merge:', cidr.size);
  const filteredCidr = excludeCidrs(Array.from(cidr), EXCLUDE_CIDRS, true);
  console.log('After Merge:', filteredCidr.length);

  await Promise.all([
    compareAndWriteFile(
      withBannerArray(
        'Sukka\'s Ruleset - Mainland China IPv4 CIDR',
        [
          'License: CC BY-SA 2.0',
          'Homepage: https://ruleset.skk.moe',
          'GitHub: https://github.com/SukkaW/Surge',
          '',
          'Data from https://misaka.io (misakaio @ GitHub)'
        ],
        new Date(),
        filteredCidr.map(i => `IP-CIDR,${i}`)
      ),
      pathResolve(__dirname, '../List/ip/china_ip.conf')
    ),
    compareAndWriteFile(
      withBannerArray(
        'Sukka\'s Ruleset - Mainland China IPv4 CIDR',
        [
          'License: CC BY-SA 2.0',
          'Homepage: https://ruleset.skk.moe',
          'GitHub: https://github.com/SukkaW/Surge',
          '',
          'Data from https://misaka.io (misakaio @ GitHub)'
        ],
        new Date(),
        filteredCidr
      ),
      pathResolve(__dirname, '../Clash/ip/china_ip.txt')
    )
  ]);

  console.timeEnd('Total Time - build-chnroutes-cidr');
})();
