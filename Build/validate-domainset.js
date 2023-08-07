// Surge Domain Set can not include root domain from public suffix list.

const tldts = require('tldts');
const picocolors = require('picocolors');
const path = require('path');
const listDir = require('@sukka/listdir');
const { readFileByLine } = require('./lib/fetch-remote-text-by-line');
const { processLine } = require('./lib/process-line');

const SPECIAL_SUFFIXES = new Set([
  'linodeobjects.com', // only *.linodeobjects.com are public suffix
  'vultrobjects.com', // only *.vultrobjects.com are public suffix
  'dweb.link' // only *.dweb.link are public suffix
]);

const validateDomainSet = async (filePath) => {
  const rl = readFileByLine(
    path.resolve(__dirname, '../List/domainset', filePath)
  );

  for await (const l of rl) {
    // starts with #
    const line = processLine(l);
    if (!line) {
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
  const rl = readFileByLine(
    path.resolve(__dirname, '../List/non_ip', filePath)
  );

  console.log(`[${filePath}]`);

  for await (const l of rl) {
    // starts with #
    const line = processLine(l);
    if (!line) {
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
};

(async () => {
  const [domainsetFiles, _rulesetFiles] = await Promise.all([
    listDir(path.resolve(__dirname, '../List/domainset')),
    listDir(path.resolve(__dirname, '../List/non_ip'))
  ]);
  await Promise.all(
    domainsetFiles.map(file => validateDomainSet(file))
    // rulesetFiles.map(file => validateRuleset(file))
  );
})();
