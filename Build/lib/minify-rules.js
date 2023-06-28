// @ts-check
/**
 * @param {string[]} rules
 */
exports.minifyRules = (rules) => rules.filter(line => {
  if (line[0] === '#') {
    return false;
  }
  if (line.trim().length === 0) {
    return false;
  }
  return true;
});
