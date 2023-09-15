// Surge Domain Set can not include root domain from public suffix list.

const tldts = require('tldts'); // hit ratio way too low, dont cache
const picocolors = require('picocolors');
const path = require('path');
const listDir = require('@sukka/listdir');
const { readFileByLine } = require('./lib/fetch-remote-text-by-line');
const { processLine } = require('./lib/process-line');
const { task } = require('./lib/trace-runner');

const SPECIAL_SUFFIXES = new Set([
  'linodeobjects.com', // only *.linodeobjects.com are public suffix
  'vultrobjects.com', // only *.vultrobjects.com are public suffix
  'dweb.link' // only *.dweb.link are public suffix
]);

const validateDomainSet = async (filePath) => {
  for await (const l of readFileByLine(path.resolve(__dirname, '../List/domainset', filePath))) {
    // starts with #
    const line = processLine(l);
    if (!line) {
      continue;
    }
    const domain = line[0] === '.' ? line.slice(1) : line;
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

const _validateRuleset = async (filePath) => {
  console.log(`[${filePath}]`);

  for await (const l of readFileByLine(path.resolve(__dirname, '../List/non_ip', filePath))) {
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

const validate = task(__filename, async () => {
  // const [domainsetFiles, _rulesetFiles] = await Promise.all([
  //   listDir(path.resolve(__dirname, '../List/domainset')),
  //   listDir(path.resolve(__dirname, '../List/non_ip'))
  // ]);
  return Promise.all([
    listDir(path.resolve(__dirname, '../List/domainset'))
      .then(domainsetFiles => Promise.all(domainsetFiles.map(file => validateDomainSet(file))))
    // rulesetFiles.map(file => validateRuleset(file))
  ]);
});
module.exports.validate = validate;

if (require.main === module) {
  validate();
}
