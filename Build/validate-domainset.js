// Surge Domain Set can not include root domain from public suffix list.

const tldts = require('tldts');
const picocolors = require('picocolors');
const fs = require('fs');
const path = require('path');
const listDir = require('@sukka/listdir');

const SPECIAL_SUFFIXES = new Set([
  'linodeobjects.com', // only *.linodeobjects.com are public suffix
  'vultrobjects.com', // only *.vultrobjects.com are public suffix
  'dweb.link' // only *.dweb.link are public suffix
]);

const validateDomainSet = async (filePath) => {
  const domainSetContent = await fs.promises.readFile(
    path.resolve(__dirname, '../List/domainset', filePath),
    { encoding: 'utf-8' }
  );
  const domainSetLines = domainSetContent.split('\n');
  for (let i = 0, len = domainSetLines.length; i < len; i++) {
    const line = domainSetLines[i];
    // starts with #
    if (line.charCodeAt(0) === 35) {
      continue;
    }
    if (line.trim().length === 0) {
      continue;
    }

    const domain = line.charCodeAt(0) === 46 ? line.slice(1) : line;
    const parsed = tldts.parse(domain, { allowPrivateDomains: true, detectIp: false });

    if (
      (
        parsed.isPrivate
        || parsed.isIcann
      ) && domain === parsed.publicSuffix
    ) {
      console.error(`[${filePath}]`, picocolors.yellow(domain), picocolors.red('is in public suffix list!'));
    }
  }
};

const validateRuleset = async (filePath) => {
  const rulesetContent = await fs.promises.readFile(
    path.resolve(__dirname, '../List/non_ip', filePath),
    { encoding: 'utf-8' }
  );
  const rulesetLines = rulesetContent.split('\n');

  console.log(`[${filePath}]`);

  for (let i = 0, len = rulesetLines.length; i < len; i++) {
    const line = rulesetLines[i];
    // starts with #
    if (line.charCodeAt(0) === 35) {
      continue;
    }
    if (line.trim().length === 0) {
      continue;
    }
    if (!line.startsWith('DOMAIN-SUFFIX,')) {
      continue;
    }
    const domain = line.slice(14);
    const parsed = tldts.parse(domain, { allowPrivateDomains: true, detectIp: false });

    if (domain !== parsed.publicSuffix) {
      if (!SPECIAL_SUFFIXES.has(domain)) {
        console.warn(picocolors.yellow(domain), picocolors.green('is not in public suffix list!'));
      }
    }
  }
}

(async () => {
  const [domainsetFiles, rulesetFiles] = await Promise.all([
    listDir(path.resolve(__dirname, '../List/domainset')),
    listDir(path.resolve(__dirname, '../List/non_ip'))
  ]);
  await Promise.all(
    domainsetFiles.map(file => validateDomainSet(file))
  );
  // await Promise.all(
  //   rulesetFiles.map(file => validateRuleset(file))
  // );
})();

