// @ts-check
const path = require('path');
const fse = require('fs-extra');
const { parseFelixDnsmasq } = require('./lib/parse-dnsmasq');
const { runner, task } = require('./lib/trace-runner');
const { compareAndWriteFile } = require('./lib/create-file');

const buildInternalChnDomains = task(__filename, async () => {
  const [result] = await Promise.all([
    parseFelixDnsmasq('https://raw.githubusercontent.com/felixonmars/dnsmasq-china-list/master/accelerated-domains.china.conf'),
    fse.ensureDir(path.resolve(__dirname, '../List/internal'))
  ]);

  await compareAndWriteFile(
    result.map(line => `SUFFIX,${line}`),
    path.resolve(__dirname, '../List/internal/accelerated-china-domains.txt')
  );
});

module.exports.buildInternalChnDomains = buildInternalChnDomains;

if (require.main === module) {
  runner(__filename, buildInternalChnDomains);
}
