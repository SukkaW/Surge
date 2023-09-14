/**
 * @param {string} [namespace]
 */
const createCache = (namespace, printStats = false) => {
  const cache = new Map();

  let hit = 0;
  if (namespace && printStats) {
    process.on('exit', () => {
      console.log(`🔋 [cache] ${namespace} hit: ${hit}, size: ${cache.size}`);
    });
  }

  return {
    /**
     * @template T
     * @param {string} key
     * @param {() => T} fn
     * @returns {T}
     */
    sync(key, fn) {
      if (cache.has(key)) {
        hit++;
        return cache.get(key);
      }
      const value = fn();
      cache.set(key, value);
      return value;
    },
    /**
     * @template T
     * @param {string} key
     * @param {() => Promise<T>} fn
     * @returns {Promise<T>}
     */
    async async(key, fn) {
      if (cache.has(key)) {
        hit++;
        return cache.get(key);
      }
      const value = await fn();
      cache.set(key, value);
      return value;
    }
  };
};
module.exports.createCache = createCache;
