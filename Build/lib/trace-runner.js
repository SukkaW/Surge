const path = require('path');

/**
 * @param {Function} fn
 * @param {string} __filename
 */
module.exports.runner = async (__filename, fn) => {
  const runnerName = path.basename(__filename, path.extname(__filename));

  const start = Date.now();
  const result = await fn();
  const end = Date.now();
  console.log(`⌛ [${runnerName}]: ${end - start}ms`);
  return result;
};
