import path from 'node:path';
import cacache from 'cacache';
import type { Buffer } from 'node:buffer';
import { CACHE_DIR } from '../constants/dir';

export interface MTProtoAuthKeyStore {
  load(dcId: number): Promise<Buffer | null>,
  save(dcId: number, key: Buffer): Promise<void>,
  drop(dcId: number): Promise<void>
}

/** a permanent auth key is exactly 2048 bits */
const AUTH_KEY_BYTES = 256;

const VERIFY_INTERVAL = 30 * 24 * 60 * 60 * 1000;
async function verifyIfStale(cachePath: string) {
  const lastRun = await cacache.verify.lastRun(cachePath).catch(() => null);
  if (lastRun === null || Date.now() - lastRun.getTime() > VERIFY_INTERVAL) {
    await cacache.verify(cachePath);
  }
}

const entryKey = (dcId: number) => `dc${dcId}`;

export function createMTProtoAuthKeyStore(cachePath: string): MTProtoAuthKeyStore {
  return {
    async load(dcId) {
      let data: Buffer;
      try {
        ({ data } = await cacache.get(cachePath, entryKey(dcId)));
      } catch {
        // ENOENT (never negotiated) or EINTEGRITY (corrupt), both mean "no key"
        return null;
      }
      return data.length === AUTH_KEY_BYTES ? data : null;
    },
    async save(dcId, key) {
      await cacache.put(cachePath, entryKey(dcId), key);
      await verifyIfStale(cachePath);
    },
    async drop(dcId) {
      await cacache.rm.entry(cachePath, entryKey(dcId));
      await verifyIfStale(cachePath);
    }
  };
}

export const mtprotoAuthKeyStore = createMTProtoAuthKeyStore(path.join(CACHE_DIR, 'telegram-mtproto-auth-keys'));
