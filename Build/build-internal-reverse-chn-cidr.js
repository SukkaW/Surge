// @ts-check
const { fetchRemoteTextAndCreateReadlineInterface } = require('./lib/fetch-remote-text-by-line');
const { processLineFromReadline } = require('./lib/process-line');
const path = require('path');
const fse = require('fs-extra');
const fs = require('fs');
const { task } = require('./lib/trace-runner');

const RESERVED_IPV4_CIDR = [
  '0.0.0.0/8',
  '10.0.0.0/8',
  '100.64.0.0/10',
  '127.0.0.0/8',
  '169.254.0.0/16',
  '172.16.0.0/12',
  '192.0.0.0/24',
  '192.0.2.0/24',
  '192.168.0.0/16',
  '198.18.0.0/15',
  '198.51.100.0/24',
  '203.0.113.0/24',
  '224.0.0.0/4',
  '233.252.0.0/24',
  '240.0.0.0/4'
];

const buildInternalReverseChnCIDR = task(__filename, async () => {
  const [{ exclude }, cidr] = await Promise.all([
    import('cidr-tools-wasm'),
    processLineFromReadline(await fetchRemoteTextAndCreateReadlineInterface('https://raw.githubusercontent.com/misakaio/chnroutes2/master/chnroutes.txt')),
    fse.ensureDir(path.resolve(__dirname, '../List/internal'))
  ]);

  const reversedCidr = exclude(
    ['0.0.0.0/0'],
    RESERVED_IPV4_CIDR.concat(cidr),
    true
  );

  return fs.promises.writeFile(
    path.resolve(__dirname, '../List/internal/reversed-chn-cidr.txt'),
    `${reversedCidr.join('\n')}\n`
  );
});

module.exports.buildInternalReverseChnCIDR = buildInternalReverseChnCIDR;

if (require.main === module) {
  buildInternalReverseChnCIDR();
}
