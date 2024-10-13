import path from 'node:path';
import fs from 'node:fs';
import makeFetchHappen from 'make-fetch-happen';
import type { FetchOptions } from 'make-fetch-happen';
import cacache from 'cacache';
import picocolors from 'picocolors';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports -- type only
import type { Response as NodeFetchResponse } from 'node-fetch';

export type { NodeFetchResponse };

const cachePath = path.resolve(__dirname, '../../.cache/__make_fetch_happen__');
fs.mkdirSync(cachePath, { recursive: true });

const _fetch = makeFetchHappen.defaults({
  cachePath,
  maxSockets: 32, /**
   * They said 15 is a good default that prevents knocking out others' routers,
   * I disagree. 32 is a good number.
   */
  headers: {
    'User-Agent': 'curl/8.9.1 (https://github.com/SukkaW/Surge)'
  },
  retry: {
    retries: 5,
    randomize: true
  }
});

export function $fetch(uriOrRequest: string | Request, opts?: FetchOptions) {
  return _fetch(uriOrRequest, opts).then((resp) => {
    printResponseStatus(resp);
    return resp;
  });
}

export async function $delete(resp: NodeFetchResponse) {
  const cacheKey = resp.headers.get('X-Local-Cache-Key');
  if (cacheKey) {
    await cacache.rm.entry(cachePath, cacheKey);
    await cacache.verify(cachePath, { concurrency: 64 });
  }
}

export function printResponseStatus(resp: NodeFetchResponse) {
  const status = resp.headers.get('X-Local-Cache-Status');
  if (status) {
    console.log('[$fetch cache]', { status }, picocolors.gray(resp.url));
  }
}
