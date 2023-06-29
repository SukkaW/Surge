// @ts-check
const fs = require('fs');
const fse = require('fs-extra');
const path = require('path');
const readline = require('readline');
const { isDomainLoose } = require('./lib/is-domain-loose');
const tldts = require('tldts');



(async () => {
  const set = new Set();
  /**
   * @param {string} input
   */
  const addApexDomain = (input) => {
    const d = tldts.getDomain(input, { allowPrivateDomains: true });
    if (d) {
      set.add(d);
    }
  };

  for await (
    const line of readline.createInterface({
      input: fs.createReadStream(path.resolve(__dirname, '../List/non_ip/cdn.conf')),
      crlfDelay: Infinity
    })
  ) {
    if (line.startsWith('DOMAIN-SUFFIX,')) {
      addApexDomain(line.replace('DOMAIN-SUFFIX,', ''))
    } else if (line.startsWith('DOMAIN,')) {
      addApexDomain(line.replace('DOMAIN,', ''));
    }
  }

  for await (
    const line of readline.createInterface({
      input: fs.createReadStream(path.resolve(__dirname, '../List/domainset/cdn.conf')),
      crlfDelay: Infinity
    })
  ) {
    if (line[0] === '.') {
      addApexDomain(line.slice(1));
    } else if (isDomainLoose(line)) {
      addApexDomain(line);
    }
  }

  for await (
    const line of readline.createInterface({
      input: fs.createReadStream(path.resolve(__dirname, '../List/domainset/download.conf')),
      crlfDelay: Infinity
    })
  ) {
    if (line[0] === '.') {
      addApexDomain(line.slice(1));
    } else if (isDomainLoose(line)) {
      addApexDomain(line);
    }
  }

  await fse.ensureDir(path.resolve(__dirname, '../List/internal'));
  await fs.promises.writeFile(
    path.resolve(__dirname, '../List/internal/cdn.txt'),
    Array.from(set).map(i => `SUFFIX,${i}`).join('\n') + '\n'
  );
})();
