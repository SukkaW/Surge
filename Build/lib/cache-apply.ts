export const createCache = (namespace?: string, printStats = false) => {
  const cache = new Map();

  let hit = 0;
  if (namespace && printStats) {
    process.on('exit', () => {
      console.log(`🔋 [cache] ${namespace} hit: ${hit}, size: ${cache.size}`);
    });
  }

  return {
    sync<T>(key: string, fn: () => T): T {
      if (cache.has(key)) {
        hit++;
        return cache.get(key);
      }
      const value = fn();
      cache.set(key, value);
      return value;
    },
    async async<T>(key: string, fn: () => Promise<T>): Promise<T> {
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
