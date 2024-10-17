import path from 'node:path';
import { Cache } from './cache-filesystem';
import type { CacheApplyOption } from './cache-filesystem';
import { isCI } from 'ci-info';

const fsMemoCache = new Cache({ cachePath: path.resolve(__dirname, '../../.cache') });

const TTL = isCI
  // We run CI daily, so 1.5 days TTL is enough to persist the cache across runs
  ? 1.5 * 86400 * 1000
  // We run locally less frequently, so we need to persist the cache for longer, 7 days
  : 7 * 86400 * 1000;

  type JSONValue =
    | string
    | number
    | boolean
    | null
    | JSONObject
    | JSONArray;

interface JSONObject {
  [key: string]: JSONValue
}

interface JSONArray extends Array<JSONValue> {}

export function cache<Args extends JSONValue[], T>(
  cb: (...args: Args) => Promise<T>,
  opt: Omit<CacheApplyOption<T, string>, 'ttl'>
): (...args: Args) => Promise<T> {
  // TODO if cb.toString() is long we should hash it
  const fixedKey = cb.toString();

  return async function cachedCb(...args: Args) {
    // Construct the complete cache key for this function invocation
    // TODO stringify is limited. For now we uses typescript to guard the args.
    const cacheKey = `${fixedKey}|${JSON.stringify(args)}`;
    const cacheName = cb.name || cacheKey;

    return fsMemoCache.apply(
      cacheKey,
      cb,
      {
        cacheName,
        ...opt,
        ttl: TTL
      } as CacheApplyOption<T, string>
    );
  };
}
