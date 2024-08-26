import createDb from 'better-sqlite3';
import type { Database } from 'better-sqlite3';
import os from 'node:os';
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import picocolors from 'picocolors';
import { fastStringArrayJoin } from './misc';
import { performance } from 'node:perf_hooks';
import fs from 'node:fs';
import { stringHash } from './string-hash';

const identity = (x: any) => x;

const enum CacheStatus {
  Hit = 'hit',
  Stale = 'stale',
  Miss = 'miss'
}

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
  temporaryBypass?: boolean
}

interface CacheApplyNonRawOption<T, S> extends CacheApplyRawOption {
  serializer: (value: T) => S,
  deserializer: (cached: S) => T
}

type CacheApplyOption<T, S> = T extends S ? CacheApplyRawOption : CacheApplyNonRawOption<T, S>;

const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

const ONE_HOUR = 60 * 60 * 1000;
const ONE_DAY = 24 * ONE_HOUR;
// Add some randomness to the cache ttl to avoid thundering herd
export const TTL = {
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
  THREE_DAYS: () => randomInt(1, 3) * ONE_DAY,
  ONE_WEEK: () => randomInt(4, 7) * ONE_DAY,
  TEN_DAYS: () => randomInt(7, 10) * ONE_DAY,
  TWO_WEEKS: () => randomInt(10, 14) * ONE_DAY
};

export class Cache<S = string> {
  db: Database;
  /** Time before deletion */
  tbd = 60 * 1000;
  /** SQLite file path */
  cachePath: string;
  /** Table name */
  tableName: string;
  type: S extends string ? 'string' : 'buffer';

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
    const insert = this.db.prepare(
      `INSERT INTO ${this.tableName} (key, value, ttl) VALUES ($key, $value, $valid) ON CONFLICT(key) DO UPDATE SET value = $value, ttl = $valid`
    );

    const valid = Date.now() + ttl;

    insert.run({
      $key: key,
      key,
      $value: value,
      value,
      $valid: valid,
      valid
    });
  }

  get(key: string, defaultValue?: S): S | undefined {
    const rv = this.db.prepare<string, { value: S }>(
      `SELECT value FROM ${this.tableName} WHERE key = ? LIMIT 1`
    ).get(key);

    if (!rv) return defaultValue;
    return rv.value;
  }

  has(key: string): CacheStatus {
    const now = Date.now();
    const rv = this.db.prepare<string, { ttl: number }>(`SELECT ttl FROM ${this.tableName} WHERE key = ?`).get(key);

    return rv ? (rv.ttl > now ? CacheStatus.Hit : CacheStatus.Stale) : CacheStatus.Miss;
  }

  del(key: string): void {
    this.db.prepare(`DELETE FROM ${this.tableName} WHERE key = ?`).run(key);
  }

  async apply<T>(
    key: string,
    fn: () => Promise<T>,
    opt: CacheApplyOption<T, S>
  ): Promise<T> {
    const { ttl, temporaryBypass } = opt;

    if (temporaryBypass) {
      return fn();
    }
    if (ttl == null) {
      this.del(key);
      return fn();
    }

    const cached = this.get(key);
    if (cached == null) {
      console.log(picocolors.yellow('[cache] miss'), picocolors.gray(key), picocolors.gray(`ttl: ${TTL.humanReadable(ttl)}`));

      const serializer = 'serializer' in opt ? opt.serializer : identity;

      const promise = fn();

      return promise.then((value) => {
        this.set(key, serializer(value), ttl);
        return value;
      });
    }

    console.log(picocolors.green('[cache] hit'), picocolors.gray(key));

    const deserializer = 'deserializer' in opt ? opt.deserializer : identity;
    return deserializer(cached);
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

export const createCacheKey = (filename: string) => {
  const fileHash = stringHash(fs.readFileSync(filename, 'utf-8'));
  return (key: string) => key + '$' + fileHash;
};
