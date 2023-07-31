// @ts-check
const { fetchRemoteTextAndCreateReadlineInterface } = require('./lib/fetch-remote-text-by-line');
const { processLine } = require('./lib/process-line');
const path = require('path');
const fse = require('fs-extra');
const fs = require('fs');

(async () => {
  /** @type {Set<string>} */
  const result = new Set();
  for await (const line of await fetchRemoteTextAndCreateReadlineInterface('https://raw.githubusercontent.com/felixonmars/dnsmasq-china-list/master/accelerated-domains.china.conf')) {
    const l = processLine(line);
    if (l) {
      result.add(
        l.replace('server=/', '').replace('/114.114.114.114', '')
      );
    }
  }

  await fse.ensureDir(path.resolve(__dirname, '../List/internal'));
  await fs.promises.writeFile(
    path.resolve(__dirname, '../List/internal/accelerated-china-domains.txt'),
    `${Array.from(result).map(line => `SUFFIX,${line}`).join('\n')}\n`
  );
})();
