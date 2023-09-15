// @ts-check

const path = require('path');
const { PathScurry } = require('path-scurry');
const { readFileByLine } = require('./lib/fetch-remote-text-by-line');
const { processLine } = require('./lib/process-line');
const { createRuleset } = require('./lib/create-file');
const { domainDeduper } = require('./lib/domain-deduper');
const { task } = require('./lib/trace-runner');

const MAGIC_COMMAND_SKIP = '# $ custom_build_script';
const MAGIC_COMMAND_TITLE = '# $ meta_title ';
const MAGIC_COMMAND_DESCRIPTION = '# $ meta_description ';

const sourceDir = path.resolve(__dirname, '../Source');
const outputSurgeDir = path.resolve(__dirname, '../List');
const outputClashDir = path.resolve(__dirname, '../Clash');

const buildCommon = task(__filename, async () => {
  /** @type {Promise<unknown>[]} */
  const promises = [];

  const pw = new PathScurry(sourceDir);
  for await (const entry of pw) {
    if (entry.isFile()) {
      if (path.extname(entry.name) === '.js') {
        continue;
      }

      const relativePath = entry.relative();
      if (relativePath.startsWith('domainset/')) {
        promises.push(transformDomainset(entry.fullpath(), relativePath));
        continue;
      }
      if (
        relativePath.startsWith('ip/')
        || relativePath.startsWith('non_ip/')
      ) {
        promises.push(transformRuleset(entry.fullpath(), relativePath));
        continue;
      }
    }
  }

  return Promise.all(promises);
});

module.exports.buildCommon = buildCommon;

if (require.main === module) {
  buildCommon();
}

/**
 * @param {string} sourcePath
 */
const processFile = async (sourcePath) => {
  /** @type {string[]} */
  const lines = [];

  let title = '';
  /** @type {string[]} */
  const descriptions = [];

  for await (const line of readFileByLine(sourcePath)) {
    if (line === MAGIC_COMMAND_SKIP) {
      return;
    }

    if (line.startsWith(MAGIC_COMMAND_TITLE)) {
      title = line.slice(MAGIC_COMMAND_TITLE.length).trim();
      continue;
    }

    if (line.startsWith(MAGIC_COMMAND_DESCRIPTION)) {
      descriptions.push(line.slice(MAGIC_COMMAND_DESCRIPTION.length).trim());
      continue;
    }

    const l = processLine(line);
    if (l) {
      lines.push(l);
    }
  }

  return /** @type {const} */ ([title, descriptions, lines]);
};

/**
 * @param {string} sourcePath
 * @param {string} relativePath
 */
async function transformDomainset(sourcePath, relativePath) {
  const res = await processFile(sourcePath);
  if (!res) return;
  const [title, descriptions, lines] = res;

  const deduped = domainDeduper(lines);
  const description = [
    'License: AGPL 3.0',
    'Homepage: https://ruleset.skk.moe',
    'GitHub: https://github.com/SukkaW/Surge',
    ...(
      descriptions.length
        ? ['', ...descriptions]
        : []
    )
  ];

  return Promise.all(createRuleset(
    title,
    description,
    new Date(),
    deduped,
    'domainset',
    path.resolve(outputSurgeDir, relativePath),
    path.resolve(outputClashDir, `${relativePath.slice(0, -path.extname(relativePath).length)}.txt`)
  ));
}

/**
 * Output Surge RULE-SET and Clash classical text format
 *
 * @param {string} sourcePath
 * @param {string} relativePath
 */
async function transformRuleset(sourcePath, relativePath) {
  const res = await processFile(sourcePath);
  if (!res) return;
  const [title, descriptions, lines] = res;

  const description = [
    'License: AGPL 3.0',
    'Homepage: https://ruleset.skk.moe',
    'GitHub: https://github.com/SukkaW/Surge',
    ...(
      descriptions.length
        ? ['', ...descriptions]
        : []
    )
  ];

  return Promise.all(createRuleset(
    title,
    description,
    new Date(),
    lines,
    'ruleset',
    path.resolve(outputSurgeDir, relativePath),
    path.resolve(outputClashDir, `${relativePath.slice(0, -path.extname(relativePath).length)}.txt`)
  ));
}
