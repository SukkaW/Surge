// @ts-check
const { fetchRemoteTextAndCreateReadlineInterface } = require('./lib/fetch-remote-text-by-line');
const { resolve: pathResolve } = require('path');
// This should not use `createRuleset` API since we are going to generate ipcidr for Clash
const { compareAndWriteFile, withBannerArray } = require('./lib/create-file');
const { processLine } = require('./lib/process-line');
const { runner } = require('./lib/trace-runner');

// https://github.com/misakaio/chnroutes2/issues/25
const EXCLUDE_CIDRS = [
  '223.118.0.0/15',
  '223.120.0.0/15'
];

const buildChnCidr = async () => {
  const { exclude: excludeCidrs } = await import('cidr-tools-wasm');

  /** @type {string[]} */
  const cidr = [];
  for await (const line of await fetchRemoteTextAndCreateReadlineInterface('https://raw.githubusercontent.com/misakaio/chnroutes2/master/chnroutes.txt')) {
    const l = processLine(line);
    if (l) {
      cidr.push(l);
    }
  }

  console.log('Before Merge:', cidr.length);
  const filteredCidr = excludeCidrs(cidr, EXCLUDE_CIDRS, true);
  console.log('After Merge:', filteredCidr.length);

  const description = [
    'License: CC BY-SA 2.0',
    'Homepage: https://ruleset.skk.moe',
    'GitHub: https://github.com/SukkaW/Surge',
    '',
    'Data from https://misaka.io (misakaio @ GitHub)'
  ];

  await Promise.all([
    compareAndWriteFile(
      withBannerArray(
        'Sukka\'s Ruleset - Mainland China IPv4 CIDR',
        description,
        new Date(),
        filteredCidr.map(i => `IP-CIDR,${i}`)
      ),
      pathResolve(__dirname, '../List/ip/china_ip.conf')
    ),
    compareAndWriteFile(
      withBannerArray(
        'Sukka\'s Ruleset - Mainland China IPv4 CIDR',
        description,
        new Date(),
        filteredCidr
      ),
      pathResolve(__dirname, '../Clash/ip/china_ip.txt')
    )
  ]);
};

module.exports.buildChnCidr = buildChnCidr;

if (require.main === module) {
  runner(__filename, buildChnCidr);
}
