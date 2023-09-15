// @ts-check
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
 * @param {string | null} [customname]
 */
module.exports.task = (__filename, fn, customname = null) => {
  const taskName = customname ?? path.basename(__filename, path.extname(__filename));
  return async () => {
    console.log(`🏃 [${taskName}] Start executing`);
    const start = performance.now();
    await fn();
    const end = performance.now();
    console.log(`✅ [${taskName}] Executed successfully: ${(end - start).toFixed(3)}ms`);

    return { start, end, taskName };
  };
};
