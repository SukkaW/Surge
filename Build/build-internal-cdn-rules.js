// @ts-check
const fse = require('fs-extra');
const path = require('path');
const tldts = require('tldts');
const { processLine } = require('./lib/process-line');
const { readFileByLine } = require('./lib/fetch-remote-text-by-line');
const domainSorter = require('./lib/stable-sort-domain');
const { task } = require('./lib/trace-runner');
const { compareAndWriteFile } = require('./lib/create-file');

/**
 * @param {string} string
 */
const escapeRegExp = (string) => {
  return string.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');
};

const buildInternalCDNDomains = task(__filename, async () => {
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
      const parsed = tldts.parse(line, { allowPrivateDomains: true });
      if (!parsed.isIp && (parsed.isIcann || parsed.isPrivate)) {
        if (parsed.domain) {
          set.add(parsed.domain);
        }
        continue;
      }

      if (processLine(line)) {
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

  await compareAndWriteFile(
    [
      ...Array.from(set).sort(domainSorter).map(i => `SUFFIX,${i}`),
      ...Array.from(keywords).sort().map(i => `REGEX,${i}`)
    ],
    path.resolve(__dirname, '../List/internal/cdn.txt')
  );
});

module.exports.buildInternalCDNDomains = buildInternalCDNDomains;

if (require.main === module) {
  buildInternalCDNDomains();
}
