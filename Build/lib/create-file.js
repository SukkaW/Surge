// @ts-check
const { promises: fsPromises } = require('fs');
const fse = require('fs-extra');
const { readFileByLine } = require('./fetch-remote-text-by-line');
const { surgeDomainsetToClashDomainset, surgeRulesetToClashClassicalTextRuleset } = require('./clash');

/**
 * @param {string[]} linesA
 * @param {string} filePath
 */
async function compareAndWriteFile(linesA, filePath) {
  await fse.ensureFile(filePath);

  let isEqual = true;
  let index = 0;

  for await (const lineB of readFileByLine(filePath)) {
    const lineA = linesA[index];
    index++;

    if (lineA[0] === '#' && lineB[0] === '#') {
      continue;
    }

    if (lineA !== lineB) {
      isEqual = false;
      break;
    }
  }

  if (!isEqual || index !== linesA.length - 1) {
    await fsPromises.writeFile(
      filePath,
      linesA.join('\n'),
      { encoding: 'utf-8' }
    );
  } else {
    console.log(`Same Content, bail out writing: ${filePath}`);
  }
}
module.exports.compareAndWriteFile = compareAndWriteFile;

/**
 * @param {string} title
 * @param {string[]} description
 * @param {Date} date
 * @param {string[]} content
 * @returns {string[]}
 */
const withBannerArray = (title, description, date, content) => {
  return [
    '########################################',
    `# ${title}`,
    `# Last Updated: ${date.toISOString()}`,
    `# Size: ${content.length}`,
    ...description.map(line => (line ? `# ${line}` : '#')),
    '########################################',
    ...content,
    '################# END ###################',
    ''
  ];
};
module.exports.withBannerArray = withBannerArray;

/**
 * @param {string} title
 * @param {string[]} description
 * @param {Date} date
 * @param {string[]} content
 * @param {'ruleset' | 'domainset'} type
 * @param {string} surgePath
 * @param {string} clashPath
 */
const createRuleset = (
  title, description, date, content,
  type, surgePath, clashPath
) => {
  const surgeContent = withBannerArray(title, description, date, content);

  let _clashContent;
  switch (type) {
    case 'domainset':
      _clashContent = surgeDomainsetToClashDomainset(content);
      break;
    case 'ruleset':
      _clashContent = surgeRulesetToClashClassicalTextRuleset(content);
      break;
    default:
      throw new TypeError(`Unknown type: ${type}`);
  }

  const clashContent = withBannerArray(title, description, date, _clashContent);

  return [
    compareAndWriteFile(surgeContent, surgePath),
    compareAndWriteFile(clashContent, clashPath)
  ];
};
module.exports.createRuleset = createRuleset;
