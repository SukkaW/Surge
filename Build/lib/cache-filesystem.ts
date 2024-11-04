import createDb from 'better-sqlite3';
import type { Database, Statement } from 'better-sqlite3';
import os from 'node:os';
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import picocolors from 'picocolors';
import { fastStringArrayJoin, identity, mergeHeaders } from './misc';
import { performance } from 'node:perf_hooks';
import fs from 'node:fs';
import { stringHash } from './string-hash';
import { defaultRequestInit, requestWithLog, ResponseError } from './fetch-retry';
import type { UndiciResponseData } from './fetch-retry';
// import type { UndiciResponseData } from './fetch-retry';
import { Custom304NotModifiedError, CustomAbortError, CustomNoETagFallbackError, fetchAssetsWithout304, sleepWithAbort } from './fetch-assets';

import type { IncomingHttpHeaders } from 'undici/types/header';
import { Headers } from 'undici';

export interface CacheOptions<S = string> {
  /** Path to sqlite file dir */
  cachePath?: string,
  /** Time before deletion */
  tbd?: number,
  /** Cache table name */
  tableName?: string,
  type?: S extends string ? 'string' : 'buffer'
}

interface CacheApplyRawOption {
  ttl?: number | null,
  temporaryBypass?: boolean,
  incrementTtlWhenHit?: boolean
}

interface CacheApplyNonRawOption<T, S> extends CacheApplyRawOption {
  serializer: (value: T) => S,
  deserializer: (cached: S) => T
}

export type CacheApplyOption<T, S> = T extends S ? CacheApplyRawOption : CacheApplyNonRawOption<T, S>;

const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

const ONE_HOUR = 60 * 60 * 1000;
const ONE_DAY = 24 * ONE_HOUR;
// Add some randomness to the cache ttl to avoid thundering herd
export const TTL = {
  useHttp304: Symbol('useHttp304'),
  humanReadable(ttl: number) {
    if (ttl >= ONE_DAY) {
      return `${Math.round(ttl / 24 / 60 / 60 / 1000)}d`;
    }
    if (ttl >= 60 * 60 * 1000) {
      return `${Math.round(ttl / 60 / 60 / 1000)}h`;
    }
    return `${Math.round(ttl / 1000)}s`;
  },
  THREE_HOURS: () => randomInt(1, 3) * ONE_HOUR,
  TWLVE_HOURS: () => randomInt(8, 12) * ONE_HOUR,
  ONE_DAY: () => randomInt(23, 25) * ONE_HOUR,
  ONE_WEEK_STATIC: ONE_DAY * 7,
  THREE_DAYS: () => randomInt(1, 3) * ONE_DAY,
  ONE_WEEK: () => randomInt(4, 7) * ONE_DAY,
  TEN_DAYS: () => randomInt(7, 10) * ONE_DAY,
  TWO_WEEKS: () => randomInt(10, 14) * ONE_DAY
};

function ensureETag(headers: IncomingHttpHeaders | Headers) {
  if (headers instanceof Headers && headers.has('etag')) {
    return headers.get('etag');
  }

  if ('etag' in headers && typeof headers.etag === 'string' && headers.etag.length > 0) {
    return headers.etag;
  }
  if ('ETag' in headers && typeof headers.ETag === 'string' && headers.ETag.length > 0) {
    return headers.ETag;
  }
  return null;
}

export class Cache<S = string> {
  private db: Database;
  /** Time before deletion */
  tbd = 60 * 1000;
  /** SQLite file path */
  cachePath: string;
  /** Table name */
  tableName: string;
  type: S extends string ? 'string' : 'buffer';

  private statement: {
    updateTtl: Statement<[number, string]>,
    del: Statement<[string]>,
    insert: Statement<[unknown]>,
    get: Statement<[string], { ttl: number, value: S }>
  };

  constructor({
    cachePath = path.join(os.tmpdir() || '/tmp', 'hdc'),
    tbd,
    tableName = 'cache',
    type
  }: CacheOptions<S> = {}) {
    const start = performance.now();

    this.cachePath = cachePath;
    mkdirSync(this.cachePath, { recursive: true });
    if (tbd != null) this.tbd = tbd;
    this.tableName = tableName;
    if (type) {
      this.type = type;
    } else {
      // @ts-expect-error -- fallback type
      this.type = 'string';
    }

    const db = createDb(path.join(this.cachePath, 'cache.db'));

    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = normal');
    db.pragma('temp_store = memory');
    db.pragma('optimize');

    db.prepare(`CREATE TABLE IF NOT EXISTS ${this.tableName} (key TEXT PRIMARY KEY, value ${this.type === 'string' ? 'TEXT' : 'BLOB'}, ttl REAL NOT NULL);`).run();
    db.prepare(`CREATE INDEX IF NOT EXISTS cache_ttl ON ${this.tableName} (ttl);`).run();

    /** cache stmt */
    this.statement = {
      updateTtl: db.prepare(`UPDATE ${this.tableName} SET ttl = ? WHERE key = ?;`),
      del: db.prepare(`DELETE FROM ${this.tableName} WHERE key = ?`),
      insert: db.prepare(`INSERT INTO ${this.tableName} (key, value, ttl) VALUES ($key, $value, $valid) ON CONFLICT(key) DO UPDATE SET value = $value, ttl = $valid`),
      get: db.prepare(`SELECT ttl, value FROM ${this.tableName} WHERE key = ? LIMIT 1`)
    } as const;

    const date = new Date();

    // perform purge on startup

    // ttl + tbd < now => ttl < now - tbd
    const now = date.getTime() - this.tbd;
    db.prepare(`DELETE FROM ${this.tableName} WHERE ttl < ?`).run(now);

    this.db = db;

    const dateString = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
    const lastVaccum = this.get('__LAST_VACUUM');
    if (lastVaccum === undefined || (lastVaccum !== dateString && date.getUTCDay() === 6)) {
      console.log(picocolors.magenta('[cache] vacuuming'));

      this.set('__LAST_VACUUM', dateString, 10 * 365 * 60 * 60 * 24 * 1000);
      this.db.exec('VACUUM;');
    }

    const end = performance.now();
    console.log(`${picocolors.gray(`[${((end - start) / 1e6).toFixed(3)}ms]`)} cache initialized from ${this.cachePath}`);
  }

  set(key: string, value: string, ttl = 60 * 1000): void {
    const valid = Date.now() + ttl;

    this.statement.insert.run({
      $key: key,
      key,
      $value: value,
      value,
      $valid: valid,
      valid
    });
  }

  get(key: string): S | null {
    const rv = this.statement.get.get(key);

    if (!rv) return null;

    if (rv.ttl < Date.now()) {
      this.del(key);
      return null;
    }

    if (rv.value == null) {
      this.del(key);
      return null;
    }

    return rv.value;
  }

  updateTtl(key: string, ttl: number): void {
    this.statement.updateTtl.run(Date.now() + ttl, key);
  }

  del(key: string): void {
    this.statement.del.run(key);
  }

  async applyWithHttp304<T>(
    url: string,
    extraCacheKey: string,
    fn: (resp: UndiciResponseData) => Promise<T>,
    opt: Omit<CacheApplyOption<T, S>, 'incrementTtlWhenHit'>
    // requestInit?: RequestInit
  ): Promise<T> {
    if (opt.temporaryBypass) {
      return fn(await requestWithLog(url));
    }

    const baseKey = url + '$' + extraCacheKey;
    const etagKey = baseKey + '$etag';
    const cachedKey = baseKey + '$cached';

    const etag = this.get(etagKey);

    const onMiss = async (resp: UndiciResponseData) => {
      const serializer = 'serializer' in opt ? opt.serializer : identity as any;

      const value = await fn(resp);

      let serverETag = ensureETag(resp.headers);
      if (serverETag) {
        // FUCK someonewhocares.org
        if (url.includes('someonewhocares.org')) {
          serverETag = serverETag.replace('-gzip', '');
        }

        console.log(picocolors.yellow('[cache] miss'), url, { status: resp.statusCode, cachedETag: etag, serverETag });

        this.set(etagKey, serverETag, TTL.ONE_WEEK_STATIC);
        this.set(cachedKey, serializer(value), TTL.ONE_WEEK_STATIC);
        return value;
      }

      this.del(etagKey);
      console.log(picocolors.red('[cache] no etag'), picocolors.gray(url));
      if (opt.ttl) {
        this.set(cachedKey, serializer(value), opt.ttl);
      }

      return value;
    };

    const cached = this.get(cachedKey);
    if (cached == null) {
      return onMiss(await requestWithLog(url));
    }

    const resp = await requestWithLog(
      url,
      {
        ...defaultRequestInit,
        headers: (typeof etag === 'string' && etag.length > 0)
          ? mergeHeaders<Record<string, string>>(defaultRequestInit.headers, { 'If-None-Match': etag })
          : defaultRequestInit.headers
      }
    );

    // Only miss if previously a ETag was present and the server responded with a 304
    if (!ensureETag(resp.headers) && resp.statusCode !== 304) {
      return onMiss(resp);
    }

    console.log(picocolors.green(`[cache] ${resp.statusCode === 304 ? 'http 304' : 'cache hit'}`), picocolors.gray(url));
    this.updateTtl(cachedKey, TTL.ONE_WEEK_STATIC);

    const deserializer = 'deserializer' in opt ? opt.deserializer : identity as any;
    return deserializer(cached);
  }

  async applyWithHttp304AndMirrors<T>(
    primaryUrl: string,
    mirrorUrls: string[],
    extraCacheKey: string,
    fn: (resp: string) => Promise<T> | T,
    opt: Omit<CacheApplyOption<T, S>, 'incrementTtlWhenHit'>
  ): Promise<T> {
    if (opt.temporaryBypass) {
      return fn(await fetchAssetsWithout304(primaryUrl, mirrorUrls));
    }

    const baseKey = primaryUrl + '$' + extraCacheKey;
    const getETagKey = (url: string) => baseKey + '$' + url + '$etag';
    const cachedKey = baseKey + '$cached';

    const controller = new AbortController();

    const previouslyCached = this.get(cachedKey);

    const createFetchFallbackPromise = async (url: string, index: number) => {
      // Most assets can be downloaded within 250ms. To avoid wasting bandwidth, we will wait for 500ms before downloading from the fallback URL.
      if (index > 0) {
        try {
          await sleepWithAbort(100 + (index + 1) * 10, controller.signal);
        } catch {
          console.log(picocolors.gray('[fetch cancelled early]'), picocolors.gray(url));
          throw new CustomAbortError();
        }
        if (controller.signal.aborted) {
          console.log(picocolors.gray('[fetch cancelled]'), picocolors.gray(url));
          throw new CustomAbortError();
        }
      }

      const etag = this.get(getETagKey(url));
      const res = await requestWithLog(
        url,
        {
          signal: controller.signal,
          ...defaultRequestInit,
          headers: (typeof etag === 'string' && etag.length > 0 && typeof previouslyCached === 'string' && previouslyCached.length > 1)
            ? mergeHeaders<Record<string, string>>(defaultRequestInit.headers, { 'If-None-Match': etag })
            : defaultRequestInit.headers
        }
      );

      const serverETag = ensureETag(res.headers);
      if (serverETag) {
        this.set(getETagKey(url), serverETag, TTL.ONE_WEEK_STATIC);
      }
      // If we do not have a cached value, we ignore 304
      if (res.statusCode === 304 && typeof previouslyCached === 'string' && previouslyCached.length > 1) {
        const err = new Custom304NotModifiedError(url, previouslyCached);
        controller.abort(err);
        throw err;
      }
      if (!serverETag && !this.get(getETagKey(primaryUrl)) && typeof previouslyCached === 'string') {
        const err = new CustomNoETagFallbackError(previouslyCached);
        controller.abort(err);
        throw err;
      }

      // either no etag and not cached
      // or has etag but not 304
      const text = await res.body.text();

      if (text.length < 2) {
        throw new ResponseError(res, url, 'empty response');
      }

      controller.abort();
      return text;
    };

    try {
      const text = mirrorUrls.length === 0
        ? await createFetchFallbackPromise(primaryUrl, -1)
        : await Promise.any([
          createFetchFallbackPromise(primaryUrl, -1),
          ...mirrorUrls.map(createFetchFallbackPromise)
        ]);

      console.log(picocolors.yellow('[cache] miss'), primaryUrl);
      const serializer = 'serializer' in opt ? opt.serializer : identity as any;

      const value = await fn(text);

      this.set(cachedKey, serializer(value), opt.ttl ?? TTL.ONE_WEEK_STATIC);

      return value;
    } catch (e) {
      const deserializer = 'deserializer' in opt ? opt.deserializer : identity as any;

      const on304 = (error: Custom304NotModifiedError) => {
        console.log(picocolors.green('[cache] http 304'), picocolors.gray(primaryUrl));
        this.updateTtl(cachedKey, TTL.ONE_WEEK_STATIC);
        return deserializer(error.data);
      };

      const onNoETagFallback = (error: CustomNoETagFallbackError) => {
        console.log(picocolors.green('[cache] hit'), picocolors.gray(primaryUrl));
        return deserializer(error.data);
      };

      if (e && typeof e === 'object') {
        if ('errors' in e && Array.isArray(e.errors)) {
          for (let i = 0, len = e.errors.length; i < len; i++) {
            const error = e.errors[i];
            if ('name' in error) {
              if (error.name === 'CustomAbortError' || error.name === 'AbortError') {
                continue;
              }
              if (error.name === 'Custom304NotModifiedError') {
                return on304(error);
              }
              if (error.name === 'CustomNoETagFallbackError') {
                return onNoETagFallback(error);
              }
            }
            if ('digest' in error) {
              if (error.digest === 'Custom304NotModifiedError') {
                return on304(error);
              }
              if (error.digest === 'CustomNoETagFallbackError') {
                return onNoETagFallback(error);
              }
            }

            console.log(picocolors.red('[fetch error]'), picocolors.gray(error.url), error);
          }
        } else {
          if ('name' in e) {
            if (e.name === 'Custom304NotModifiedError') {
              return on304(e as Custom304NotModifiedError);
            }
            if (e.name === 'CustomNoETagFallbackError') {
              return onNoETagFallback(e as CustomNoETagFallbackError);
            }
          }
          if ('digest' in e) {
            if (e.digest === 'Custom304NotModifiedError') {
              return on304(e as Custom304NotModifiedError);
            }
            if (e.digest === 'CustomNoETagFallbackError') {
              return onNoETagFallback(e as CustomNoETagFallbackError);
            }
          }

          console.log(picocolors.red('[fetch error]'), picocolors.gray(primaryUrl), e);
        }
      }

      console.log({ e, name: (e as any).name });

      console.log(`Download Rule for [${primaryUrl}] failed`);
      throw e;
    }
  }

  destroy() {
    this.db.close();
  }
}

export const fsFetchCache = new Cache({ cachePath: path.resolve(__dirname, '../../.cache') });
// process.on('exit', () => {
//   fsFetchCache.destroy();
// });

// export const fsCache = traceSync('initializing filesystem cache', () => new Cache<Uint8Array>({ cachePath: path.resolve(__dirname, '../../.cache'), type: 'buffer' }));

const separator = '\u0000';
export const serializeSet = (set: Set<string>) => fastStringArrayJoin(Array.from(set), separator);
export const deserializeSet = (str: string) => new Set(str.split(separator));
export const serializeArray = (arr: string[]) => fastStringArrayJoin(arr, separator);
export const deserializeArray = (str: string) => str.split(separator);

export const getFileContentHash = (filename: string) => stringHash(fs.readFileSync(filename, 'utf-8'));
export function createCacheKey(filename: string) {
  const fileHash = getFileContentHash(filename);
  return (key: string) => key + '$' + fileHash + '$';
}
