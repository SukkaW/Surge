// @ts-check
const { promises: fsPromises } = require('fs');
const fse = require('fs-extra');

/**
 * @param {string[]} linesA
 * @param {string} filePath
 */
async function compareAndWriteFile(linesA, filePath) {
  await fse.ensureFile(filePath);
  const linesB = (await fsPromises.readFile(filePath, { encoding: 'utf-8' })).split('\n');

  if (!stringArrayCompare(linesA, linesB)) {
    await fsPromises.writeFile(
      filePath,
      linesA.join('\n'),
      { encoding: 'utf-8' }
    );
  } else {
    console.log(`Same Content, bail out writing: ${filePath}`);
  }
}

/**
 * @param {string[]} linesA
 * @param {string[]} linesB
 */
function stringArrayCompare(linesA, linesB) {
  if (linesA.length !== linesB.length) return false;

  for (let i = 0; i < linesA.length; i++) {
    const lineA = linesA[i];
    const lineB = linesB[i];
    if (lineA.startsWith('#') && lineB.startsWith('#')) {
      continue;
    }
    if (lineA !== lineB) {
      return false;
    }
  }

  return true;
}

module.exports.stringArrayCompare = stringArrayCompare;
module.exports.compareAndWriteFile = compareAndWriteFile;
