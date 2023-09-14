const path = require('path');
const { performance } = require('perf_hooks');

/**
 * @template T
 * @param {string} prefix
 * @param {() => T} fn
 * @returns {T}
 */
const traceSync = (prefix, fn) => {
  const start = performance.now();
  const result = fn();
  const end = performance.now();
  console.log(`${prefix}: ${(end - start).toFixed(3)}ms`);
  return result;
};
module.exports.traceSync = traceSync;

/**
 * @template T
 * @param {string} prefix
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
const traceAsync = async (prefix, fn) => {
  const start = performance.now();
  const result = await fn();
  const end = performance.now();
  console.log(`${prefix}: ${(end - start).toFixed(3)}ms`);
  return result;
};
module.exports.traceAsync = traceAsync;

/**
 * @template T
 * @param {string} __filename
 * @param {() => Promise<T>} fn
 * @returns {T}
 */
module.exports.runner = async (__filename, fn) => {
  return traceAsync(`⌛ [${path.basename(__filename, path.extname(__filename))}]`, fn);
};
