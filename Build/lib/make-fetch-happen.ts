import path from 'node:path';
import fs from 'node:fs';
import makeFetchHappen from 'make-fetch-happen';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports -- type only
export type { Response as NodeFetchResponse } from 'node-fetch';

const cachePath = path.resolve(__dirname, '../../.cache/__make_fetch_happen__');
fs.mkdirSync(cachePath, { recursive: true });

export const $fetch = makeFetchHappen.defaults({
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
