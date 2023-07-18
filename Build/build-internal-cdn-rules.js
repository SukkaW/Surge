// @ts-check
const fs = require('fs');
const fse = require('fs-extra');
const path = require('path');
const readline = require('readline');
const { isDomainLoose } = require('./lib/is-domain-loose');
const tldts = require('tldts');
const { processLine } = require('./lib/process-line');

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

  /**
   * @param {string} domainSetPath
   */
  const processLocalDomainSet = async (domainSetPath) => {
    for await (
      const line of readline.createInterface({
        input: fs.createReadStream(domainSetPath),
        crlfDelay: Infinity
      })
    ) {
      if (line[0] === '.') {
        addApexDomain(line.slice(1));
      } else if (isDomainLoose(line)) {
        addApexDomain(line);
      } else if (processLine(line)) {
        console.warn('[drop line from domainset]', line);
      }
    }
  };

  /**
   * @param {string} ruleSetPath
   */
  const processLocalRuleSet = async (ruleSetPath) => {
    for await (
      const line of readline.createInterface({
        input: fs.createReadStream(ruleSetPath),
        crlfDelay: Infinity
      })
    ) {
      if (line.startsWith('DOMAIN-SUFFIX,')) {
        addApexDomain(line.replace('DOMAIN-SUFFIX,', ''));
      } else if (line.startsWith('DOMAIN,')) {
        addApexDomain(line.replace('DOMAIN,', ''));
      } else if (processLine(line)) {
        console.warn('[drop line from ruleset]', line);
      }
    }
  };

  await processLocalRuleSet(path.resolve(__dirname, '../List/non_ip/cdn.conf'));
  await processLocalRuleSet(path.resolve(__dirname, '../List/non_ip/global.conf'));
  await processLocalRuleSet(path.resolve(__dirname, '../List/non_ip/global_plus.conf'));
  await processLocalRuleSet(path.resolve(__dirname, '../List/non_ip/my_proxy.conf'));
  await processLocalRuleSet(path.resolve(__dirname, '../List/non_ip/stream.conf'));
  await processLocalRuleSet(path.resolve(__dirname, '../List/non_ip/telegram.conf'));

  await processLocalDomainSet(path.resolve(__dirname, '../List/domainset/cdn.conf'));
  await processLocalDomainSet(path.resolve(__dirname, '../List/domainset/download.conf'));

  await fse.ensureDir(path.resolve(__dirname, '../List/internal'));
  await fs.promises.writeFile(
    path.resolve(__dirname, '../List/internal/cdn.txt'),
    `${Array.from(set).map(i => `SUFFIX,${i}`).join('\n')}\n`
  );
})();
