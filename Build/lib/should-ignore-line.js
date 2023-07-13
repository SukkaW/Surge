/* eslint-disable camelcase -- cache index access */

/**
 * @param {string} line
 */
module.exports.shouldIgnoreLine = (line) => {
  if (line === '') {
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
