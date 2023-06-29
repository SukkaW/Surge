// @ts-check
const fs = require('fs');
const fse = require('fs-extra');
const path = require('path');
const readline = require('readline');
const { isDomainLoose } = require('./lib/is-domain-loose');

(async () => {
  const results = [];

  for await (
    const line of readline.createInterface({
      input: fs.createReadStream(path.resolve(__dirname, '../List/non_ip/cdn.conf')),
      crlfDelay: Infinity
    })
  ) {
    if (line.startsWith('DOMAIN-SUFFIX,')) {
      results.push(line.replace('DOMAIN-SUFFIX,', 'SUFFIX,'));
    } else if (line.startsWith('DOMAIN,')) {
      results.push(line.replace('DOMAIN,', 'SUFFIX,'));
    }
  }

  for await (
    const line of readline.createInterface({
      input: fs.createReadStream(path.resolve(__dirname, '../List/domainset/cdn.conf')),
      crlfDelay: Infinity
    })
  ) {
    if (line[0] === '.') {
      results.push(`SUFFIX,${line.slice(1)}`);
    } else if (isDomainLoose(line)) {
      results.push(`SUFFIX,${line}`);
    }
  }

  for await (
    const line of readline.createInterface({
      input: fs.createReadStream(path.resolve(__dirname, '../List/domainset/download.conf')),
      crlfDelay: Infinity
    })
  ) {
    if (line[0] === '.') {
      results.push(`SUFFIX,${line.slice(1)}`);
    } else if (isDomainLoose(line)) {
      results.push(`SUFFIX,${line}`);
    }
  }

  results.push('');

  await fse.ensureDir(path.resolve(__dirname, '../List/internal'));
  await fs.promises.writeFile(
    path.resolve(__dirname, '../List/internal/cdn.csv'),
    results.join('\n')
  );
})();
