const globalMap = new Map<string, Map<string, Promise<unknown>>>();

export function createKeyedAsyncMutex(globalNamespaceKey: string) {
  let map;
  if (globalMap.has(globalNamespaceKey)) {
    map = globalMap.get(globalNamespaceKey)!;
  } else {
    map = new Map();
    globalMap.set(globalNamespaceKey, map);
  }

  return {
    async acquire<T = unknown>(key: string, fn: () => Promise<T>) {
      if (map.has(key)) {
        return map.get(key);
      }

      const promise = fn();
      map.set(key, promise);
      return promise;
    }
  };
}
