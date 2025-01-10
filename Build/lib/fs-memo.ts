import path from 'node:path';
import { isCI } from 'ci-info';

import picocolors from 'picocolors';
import { Cache } from './cache-filesystem';
import { createMemoize } from 'foxts/serialized-memo';
import type { MemoizeStorageProvider } from 'foxts/serialized-memo';
import { ROOT_DIR } from '../constants/dir';

const fsMemoCache = new Cache({ cachePath: path.join(ROOT_DIR, '.cache'), tableName: 'fs_memo_cache' });

const fsMemoCacheProvider: MemoizeStorageProvider = {
  has(key) {
    return fsMemoCache.get(key) !== null;
  },
  delete() {
    // noop
  },
  get(key) {
    return fsMemoCache.get(key) ?? undefined;
  },
  set(key, value, ttl) {
    fsMemoCache.set(key, value, ttl);
  },
  updateTtl(key, ttl) {
    fsMemoCache.updateTtl(key, ttl);
  }
};

const TTL = isCI
  // We run CI daily, so 1.5 days TTL is enough to persist the cache across runs
  ? 1.5 * 86400 * 1000
  // We run locally less frequently, so we need to persist the cache for longer, 7 days
  : 7 * 86400 * 1000;

export const cache = createMemoize(fsMemoCacheProvider, {
  defaultTtl: TTL,
  onCacheMiss(key, { humanReadableName, isUseCachedIfFail }) {
    const cacheName = picocolors.gray(humanReadableName);
    if (isUseCachedIfFail) {
      console.log(picocolors.red('[fail] and no cache, throwing'), cacheName);
    } else {
      console.log(picocolors.yellow('[cache] miss'), cacheName);
    }
  },
  onCacheUpdate(key, { humanReadableName, isUseCachedIfFail }) {
    const cacheName = picocolors.gray(humanReadableName);
    if (isUseCachedIfFail) {
      console.log(picocolors.gray('[cache] update'), cacheName);
    }
  },
  onCacheHit(key, { humanReadableName, isUseCachedIfFail }) {
    const cacheName = picocolors.gray(humanReadableName);
    if (isUseCachedIfFail) {
      console.log(picocolors.yellow('[fail] try cache'), cacheName);
    } else {
      console.log(picocolors.green('[cache] hit'), cacheName);
    }
  }
});

export const cachedOnlyFail = createMemoize(fsMemoCacheProvider, {
  defaultTtl: TTL,
  onlyUseCachedIfFail: true
});

// export const cache = createCache(false);
// export const cachedOnlyFail = createCache(true);
