// @ts-check
const fs = require('fs');
const fse = require('fs-extra');
const path = require('path');
const { isDomainLoose } = require('./lib/is-domain-loose');
const tldts = require('tldts');
const { processLine } = require('./lib/process-line');
const { readFileByLine } = require('./lib/fetch-remote-text-by-line');

/**
 * @param {string} string
 */
const escapeRegExp = (string) => {
  return string.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');
};

(async () => {
  const set = new Set();
  const keywords = new Set();

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
    for await (const line of readFileByLine(domainSetPath)) {
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
    for await (const line of readFileByLine(ruleSetPath)) {
      if (line.startsWith('DOMAIN-SUFFIX,')) {
        addApexDomain(line.replace('DOMAIN-SUFFIX,', ''));
      } else if (line.startsWith('DOMAIN,')) {
        addApexDomain(line.replace('DOMAIN,', ''));
      } else if (line.startsWith('DOMAIN-KEYWORD')) {
        keywords.add(escapeRegExp(line.replace('DOMAIN-KEYWORD,', '')));
      } else if (line.startsWith('USER-AGENT,') || line.startsWith('PROCESS-NAME,')) {
        // do nothing
      } else if (processLine(line)) {
        console.warn('[drop line from ruleset]', line);
      }
    }
  };

  await Promise.all([
    processLocalRuleSet(path.resolve(__dirname, '../List/non_ip/cdn.conf')),
    processLocalRuleSet(path.resolve(__dirname, '../List/non_ip/global.conf')),
    processLocalRuleSet(path.resolve(__dirname, '../List/non_ip/global_plus.conf')),
    processLocalRuleSet(path.resolve(__dirname, '../List/non_ip/my_proxy.conf')),
    processLocalRuleSet(path.resolve(__dirname, '../List/non_ip/stream.conf')),
    processLocalRuleSet(path.resolve(__dirname, '../List/non_ip/telegram.conf')),
    processLocalDomainSet(path.resolve(__dirname, '../List/domainset/cdn.conf')),
    processLocalDomainSet(path.resolve(__dirname, '../List/domainset/download.conf')),

    fse.ensureDir(path.resolve(__dirname, '../List/internal'))
  ]);

  await fs.promises.writeFile(
    path.resolve(__dirname, '../List/internal/cdn.txt'),
    [
      ...Array.from(set).map(i => `SUFFIX,${i}`),
      ...Array.from(keywords).map(i => `REGEX,${i}`),
      ''
    ].join('\n')
  );
})();
