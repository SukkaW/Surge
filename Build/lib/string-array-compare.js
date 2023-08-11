// @ts-check
const { promises: fsPromises } = require('fs');
const fse = require('fs-extra');
const { readFileByLine } = require('./fetch-remote-text-by-line');

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

  if (!isEqual) {
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
