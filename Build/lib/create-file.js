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
  } else {
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

    if (index !== linesA.length) {
      isEqual = false;
    }
  }

  if (!isEqual) {
    const stream = fs.createWriteStream(filePath, { encoding: 'utf-8' });

    for (let i = 0, len = linesA.length; i < len; i++) {
      const p = writeToStream(stream, `${linesA[i]}\n`);
      if (p) {
        // eslint-disable-next-line no-await-in-loop -- backpressure, besides we only wait for drain
        await p;
      }
    }
    stream.end();
  } else {
    console.log(`Same Content, bail out writing: ${filePath}`);
  }
}
module.exports.compareAndWriteFile = compareAndWriteFile;

/**
 * @param {import('fs').WriteStream} stream
 * @param {string} data
 */
function writeToStream(stream, data) {
  if (!stream.write(data)) {
    return /** @type {Promise<void>} */(new Promise((resolve) => {
      stream.once('drain', resolve);
    }));
  }
  return null;
}

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
