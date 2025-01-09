import path from 'node:path';
import fsp from 'node:fs/promises';
// import makeFetchHappen from 'make-fetch-happen';
// import type { FetchOptions } from 'make-fetch-happen';
// import cacache from 'cacache';
// import picocolors from 'picocolors';

import { task } from '../trace';
// import { bytes } from 'xbits';

const cachePath = path.resolve(__dirname, '../../.cache/__make_fetch_happen__');
// fs.mkdirSync(cachePath, { recursive: true });

// interface CacacheVerifyStats {
//   startTime: Date,
//   endTime: Date,
//   runTime: {
//     markStartTime: 0,
//     fixPerms: number,
//     garbageCollect: number,
//     rebuildIndex: number,
//     cleanTmp: number,
//     writeVerifile: number,
//     markEndTime: number,
//     total: number
//   },
//   verifiedContent: number,
//   reclaimedCount: number,
//   reclaimedSize: number,
//   badContentCount: number,
//   keptSize: number,
//   missingContent: number,
//   rejectedEntries: number,
//   totalEntries: number
// }

export const cacheGc = task(require.main === module, __filename)(
  () => fsp.rm(cachePath, { recursive: true, force: true })
  // span
  //   .traceChildAsync('cacache gc', () => cacache.verify(cachePath, { concurrency: 64 }))
  //   .then((stats: CacacheVerifyStats) => {
  //   // console.log({ stats });
  //     console.log(picocolors.green('[cacheGc] running gc on cache:'), cachePath);
  //     console.log(picocolors.green('[cacheGc] content verified:'), stats.verifiedContent, '(' + bytes(stats.keptSize) + ')');
  //     console.log(picocolors.green('[cacheGc] reclaimed:'), stats.reclaimedCount, '(' + bytes(stats.reclaimedSize) + ')');
  //   });
);

// const _fetch = makeFetchHappen.defaults({
//   cachePath,
//   maxSockets: 32, /**
//    * They said 15 is a good default that prevents knocking out others' routers,
//    * I disagree. 32 is a good number.
//    */
//   headers: {
//     'User-Agent': 'curl/8.9.1 (https://github.com/SukkaW/Surge)'
//   },
//   retry: {
//     retries: 5,
//     randomize: true
//   }
// });

// export function $fetch(uriOrRequest: string | Request, opts?: FetchOptions) {
//   return _fetch(uriOrRequest, opts).then((resp) => {
//     printResponseStatus(resp);
//     return resp;
//   });
// }

// export async function $delete(resp: NodeFetchResponse) {
//   const cacheKey = resp.headers.get('X-Local-Cache-Key');
//   if (cacheKey) {
//     await cacache.rm.entry(cachePath, cacheKey);
//     await cacache.verify(cachePath, { concurrency: 64 });
//   }
// }

// export function printResponseStatus(resp: NodeFetchResponse) {
//   const status = resp.headers.get('X-Local-Cache-Status');
//   if (status) {
//     console.log('[$fetch cache]', { status }, picocolors.gray(resp.url));
//   }
// }

// export { type Response as NodeFetchResponse } from 'node-fetch';
