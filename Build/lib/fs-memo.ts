import path from 'node:path';
import { Cache } from './cache-filesystem';
import type { CacheApplyOption } from './cache-filesystem';
import { isCI } from 'ci-info';

import { xxhash64 } from 'hash-wasm';

import { Typeson, set, map, typedArrays, undef, infinity } from 'typeson-registry';
import picocolors from 'picocolors';
import { identity } from './misc';

const typeson = new Typeson().register([
  typedArrays,
  set,
  map,
  undef,
  infinity
]);

const fsMemoCache = new Cache({ cachePath: path.resolve(__dirname, '../../.cache'), tableName: 'fs_memo_cache' });

const TTL = isCI
  // We run CI daily, so 1.5 days TTL is enough to persist the cache across runs
  ? 1.5 * 86400 * 1000
  // We run locally less frequently, so we need to persist the cache for longer, 7 days
  : 7 * 86400 * 1000;

type TypesonValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Set<any>
  | Map<any, any>
  | TypesonObject
  | TypesonArray;

interface TypesonObject {
  [key: string]: TypesonValue
}

interface TypesonArray extends Array<TypesonValue> { }

export type FsMemoCacheOptions<T> = CacheApplyOption<T, string> & {
  ttl?: undefined | never
};

export function cache<Args extends TypesonValue[], T>(
  fn: (...args: Args) => Promise<T>,
  opt: FsMemoCacheOptions<T>
): (...args: Args) => Promise<T> {
  const fixedKey = fn.toString();

  return async function cachedCb(...args: Args) {
    // Construct the complete cache key for this function invocation
    // typeson.stringify is still limited. For now we uses typescript to guard the args.
    const cacheKey = (await Promise.all([
      xxhash64(fixedKey),
      xxhash64(typeson.stringifySync(args))
    ])).join('|');

    const cacheName = fn.name || fixedKey;

    const { temporaryBypass, incrementTtlWhenHit } = opt;

    if (temporaryBypass) {
      return fn(...args);
    }

    const cached = fsMemoCache.get(cacheKey);
    if (cached == null) {
      console.log(picocolors.yellow('[cache] miss'), picocolors.gray(cacheName || cacheKey));

      const serializer = 'serializer' in opt ? opt.serializer : identity as any;

      const value = await fn(...args);

      fsMemoCache.set(cacheKey, serializer(value), TTL);
      return value;
    }

    console.log(picocolors.green('[cache] hit'), picocolors.gray(cacheName || cacheKey));

    if (incrementTtlWhenHit) {
      fsMemoCache.updateTtl(cacheKey, TTL);
    }

    const deserializer = 'deserializer' in opt ? opt.deserializer : identity as any;
    return deserializer(cached);
  };
}
