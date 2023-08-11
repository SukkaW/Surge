// @ts-check
const path = require('path');
const fse = require('fs-extra');
const fs = require('fs');
const { parseFelixDnsmasq } = require('./lib/parse-dnsmasq');

(async () => {
  const [result] = await Promise.all([
    parseFelixDnsmasq('https://raw.githubusercontent.com/felixonmars/dnsmasq-china-list/master/accelerated-domains.china.conf'),
    fse.ensureDir(path.resolve(__dirname, '../List/internal'))
  ]);

  await fs.promises.writeFile(
    path.resolve(__dirname, '../List/internal/accelerated-china-domains.txt'),
    `${result.map(line => `SUFFIX,${line}`).join('\n')}\n`
  );
})();
