// @ts-check
const fs = require('fs');
const { readFileByLine } = require('./fetch-remote-text-by-line');
const { surgeDomainsetToClashDomainset, surgeRulesetToClashClassicalTextRuleset } = require('./clash');

/**
 * @param {string[]} linesA
 * @param {string} filePath
 */
async function compareAndWriteFile(linesA, filePath) {
  let isEqual = true;
  if (!fs.existsSync(filePath)) {
    console.log(`${filePath} does not exists, writing...`);
    isEqual = false;
  } else if (linesA.length === 0) {
    console.log(`Nothing to write to ${filePath}...`);
    isEqual = false;
  } else {
    let index = 0;

    for await (const lineB of readFileByLine(filePath)) {
      const lineA = linesA[index];
      index++;

      if (lineA === undefined) {
        // The file becomes smaller
        isEqual = false;
        break;
      }

      if (lineA[0] === '#' && lineB[0] === '#') {
        continue;
      }

      if (lineA !== lineB) {
        isEqual = false;
        break;
      }
    }

    if (index !== linesA.length) {
      isEqual = false;
    }
  }

  if (!isEqual) {
    const file = Bun.file(filePath);
    const writer = file.writer();

    for (let i = 0, len = linesA.length; i < len; i++) {
      writer.write(`${linesA[i]}\n`);
    }

    await writer.end();
    return;
  }

  console.log(`Same Content, bail out writing: ${filePath}`);
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
    '################# END ###################'
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
