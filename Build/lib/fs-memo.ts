import path from 'node:path';
import { Cache } from './cache-filesystem';
import type { CacheApplyOption } from './cache-filesystem';
import { isCI } from 'ci-info';

import { xxhash64 } from 'hash-wasm';

import picocolors from 'picocolors';
import { identity } from './misc';

const fsMemoCache = new Cache({ cachePath: path.resolve(__dirname, '../../.cache'), tableName: 'fs_memo_cache' });

const TTL = isCI
  // We run CI daily, so 1.5 days TTL is enough to persist the cache across runs
  ? 1.5 * 86400 * 1000
  // We run locally less frequently, so we need to persist the cache for longer, 7 days
  : 7 * 86400 * 1000;

type TypedArray = Int8Array | Uint8Array | Uint8ClampedArray | Int16Array | Uint16Array | Int32Array | Uint32Array | Float32Array | Float64Array | BigInt64Array | BigUint64Array;

// https://github.com/Rich-Harris/devalue/blob/f3fd2aa93d79f21746555671f955a897335edb1b/src/stringify.js#L77
type Devalue =
  | number
  | string
  | boolean
  | bigint
  | Date
  | RegExp
  | Set<Devalue>
  | Devalue[]
  | null
  | undefined
  | Map<Devalue, Devalue>
  | DevalueObject
  | TypedArray
  | ArrayBuffer;

// Has to use an interface to avoid circular reference
interface DevalueObject {
  [key: string]: Devalue
}

export type FsMemoCacheOptions<T> = CacheApplyOption<T, string> & {
  ttl?: undefined | never
};

function createCache(onlyUseCachedIfFail: boolean) {
  return function cache<Args extends Devalue[], T>(
    fn: (...args: Args) => Promise<T>,
    opt: FsMemoCacheOptions<T>
  ): (...args: Args) => Promise<T> {
    const fixedKey = fn.toString();

    if (opt.temporaryBypass) {
      return fn;
    }

    return async function cachedCb(...args: Args) {
      const { stringify: devalueStringify } = await import('devalue');

      // Construct the complete cache key for this function invocation
      // typeson.stringify is still limited. For now we uses typescript to guard the args.
      const cacheKey = (await Promise.all([
        xxhash64(fixedKey),
        xxhash64(devalueStringify(args))
      ])).join('|');

      const cacheName = picocolors.gray(fn.name || fixedKey || cacheKey);

      const cached = fsMemoCache.get(cacheKey);

      const serializer = 'serializer' in opt ? opt.serializer : identity as any;
      const deserializer = 'deserializer' in opt ? opt.deserializer : identity as any;

      if (onlyUseCachedIfFail) {
        try {
          const value = await fn(...args);

          console.log(picocolors.gray('[cache] update'), cacheName);
          fsMemoCache.set(cacheKey, serializer(value), TTL);

          return value;
        } catch (e) {
          if (cached == null) {
            console.log(picocolors.red('[fail] and no cache, throwing'), cacheName);
            throw e;
          }

          fsMemoCache.updateTtl(cacheKey, TTL);

          console.log(picocolors.yellow('[fail] try cache'), cacheName);

          return deserializer(cached);
        }
      } else {
        if (cached == null) {
          console.log(picocolors.yellow('[cache] miss'), cacheName);

          const value = await fn(...args);

          fsMemoCache.set(cacheKey, serializer(value), TTL);
          return value;
        }

        console.log(picocolors.green('[cache] hit'), cacheName);

        fsMemoCache.updateTtl(cacheKey, TTL);

        return deserializer(cached);
      }
    };
  };
}

export const cache = createCache(false);
export const cachedOnlyFail = createCache(true);
