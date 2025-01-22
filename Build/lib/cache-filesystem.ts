import createDb from 'better-sqlite3';
import type { Database, Statement } from 'better-sqlite3';
import os from 'node:os';
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import picocolors from 'picocolors';
import { fastStringArrayJoin } from 'foxts/fast-string-array-join';
import { performance } from 'node:perf_hooks';
import fs from 'node:fs';
import { simpleStringHash } from 'foxts/simple-string-hash';
// import type { UndiciResponseData } from './fetch-retry';

import { CACHE_DIR } from '../constants/dir';

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
    console.log(`${picocolors.gray(`[${((end - start)).toFixed(3)}ns]`)} cache initialized from ${this.tableName} @ ${this.cachePath}`);
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

  destroy() {
    this.db.close();
  }

  deleteTable(tableName: string) {
    this.db.exec(`DROP TABLE IF EXISTS ${tableName};`);
  }
}

// drop deprecated cache
new Cache({ cachePath: CACHE_DIR }).deleteTable('cache');

// process.on('exit', () => {
//   fsFetchCache.destroy();
// });

const separator = '\u0000';
export const serializeSet = (set: Set<string>) => fastStringArrayJoin(Array.from(set), separator);
export const deserializeSet = (str: string) => new Set(str.split(separator));
export const serializeArray = (arr: string[]) => fastStringArrayJoin(arr, separator);
export const deserializeArray = (str: string) => str.split(separator);

const getFileContentHash = (filename: string) => simpleStringHash(fs.readFileSync(filename, 'utf-8'));
export function createCacheKey(filename: string) {
  const fileHash = getFileContentHash(filename);
  return (key: string) => key + '$' + fileHash + '$';
}
