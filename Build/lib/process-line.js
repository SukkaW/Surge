/* eslint-disable camelcase -- cache index access */

/**
 * If line is commented out or empty, return null.
 * Otherwise, return trimmed line.
 *
 * @param {string} line
 */
const processLine = (line) => {
  if (!line) {
    return null;
  }

  const line_0 = line[0];

  if (
    line_0 === '#'
    || line_0 === ' '
    || line_0 === '\r'
    || line_0 === '\n'
    || line_0 === '!'
  ) {
    return null;
  }

  const trimmed = line.trim();
  if (trimmed === '') {
    return null;
  }

  return trimmed;
};
module.exports.processLine = processLine;

/**
 * @param {import('readline').ReadLine} rl
 */
module.exports.processLineFromReadline = async (rl) => {
  /** @type {string[]} */
  const res = [];
  for await (const line of rl) {
    const l = processLine(line);
    if (l) {
      res.push(l);
    }
  }
  return res;
};
