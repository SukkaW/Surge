import { describe, it } from 'mocha';
import { expect } from 'earl';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

import { createMTProtoAuthKeyStore } from './mtproto-auth-key-store';

function tmpStorePath() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mtproto-auth-key-')), 'keys');
}

describe('mtproto auth key store', () => {
  it('round-trips a key per DC and survives reopening the directory', async () => {
    const dir = tmpStorePath();
    const dc1 = randomBytes(256);
    const dc2 = randomBytes(256);

    const store = createMTProtoAuthKeyStore(dir);
    expect(await store.load(1)).toEqual(null);
    await store.save(1, dc1);
    await store.save(2, dc2);
    expect((await store.load(1))?.equals(dc1)).toEqual(true);
    expect((await store.load(2))?.equals(dc2)).toEqual(true);

    // a fresh handle on the same directory is what the next build sees
    const reopened = createMTProtoAuthKeyStore(dir);
    expect((await reopened.load(1))?.equals(dc1)).toEqual(true);
  });

  it('replaces on save and forgets on drop', async () => {
    const store = createMTProtoAuthKeyStore(tmpStorePath());
    const first = randomBytes(256);
    const second = randomBytes(256);

    await store.save(4, first);
    await store.save(4, second);
    expect((await store.load(4))?.equals(second)).toEqual(true);

    await store.drop(4);
    expect(await store.load(4)).toEqual(null);
    // dropping an absent key is a no-op
    await store.drop(4);
  });

  it('treats a key of the wrong size as absent', async () => {
    const store = createMTProtoAuthKeyStore(tmpStorePath());
    await store.save(5, randomBytes(16));
    expect(await store.load(5)).toEqual(null);
  });
});
