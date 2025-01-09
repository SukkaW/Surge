import path from 'node:path';
import { task } from './trace';

import { getChnCidrPromise } from './build-chn-cidr';
// import { RESERVED_IPV4_CIDR, NON_CN_CIDR_INCLUDED_IN_CHNROUTE } from './constants/cidr';

import fs from 'node:fs';
import { OUTPUT_INTERNAL_DIR } from './constants/dir';
import { asyncWriteToStream } from 'foxts/async-write-to-stream';
import { mkdirp } from './lib/misc';
// import { appendArrayInPlace } from './lib/append-array-in-place';
import Worktank from 'worktank';

const pool = new Worktank({
  name: 'build-internal-reverse-chn-cidr',
  size: 1,
  timeout: 10000, // The maximum number of milliseconds to wait for the result from the worker, if exceeded the worker is terminated and the execution promise rejects
  warmup: true,
  autoterminate: 30000, // The interval of milliseconds at which to check if the pool can be automatically terminated, to free up resources, workers will be spawned up again if needed
  env: {},
  methods: { // An object mapping function names to functions objects to serialize and deserialize into each worker thread, only functions that don't depend on their closure can be serialized
    // eslint-disable-next-line object-shorthand -- workertank
    getreversedCidr: async function (cidr: string[], importMetaUrl: string): Promise<string[]> {
      // TODO: createRequire is a temporary workaround for https://github.com/nodejs/node/issues/51956
      const { default: module } = await import('node:module');
      const __require = module.createRequire(importMetaUrl);
      const { exclude, merge } = __require('fast-cidr-tools');
      const { RESERVED_IPV4_CIDR, NON_CN_CIDR_INCLUDED_IN_CHNROUTE } = __require('./constants/cidr');
      const { appendArrayInPlace } = __require('./lib/append-array-in-place');

      return merge(
        appendArrayInPlace(
          exclude(
            ['0.0.0.0/0'],
            RESERVED_IPV4_CIDR.concat(cidr),
            true
          ),
          // https://github.com/misakaio/chnroutes2/issues/25
          NON_CN_CIDR_INCLUDED_IN_CHNROUTE
        ),
        true
      );
    }
  }
});

export const buildInternalReverseChnCIDR = task(require.main === module, __filename)(async (span) => {
  const [cidr] = await span.traceChildPromise('download chnroutes2', getChnCidrPromise());

  const reversedCidr = await span.traceChildAsync('build reversed chn cidr', async () => {
    const reversedCidr = await pool.exec(
      'getreversedCidr',
      [cidr, import.meta.url]
    );
    pool.terminate();

    return reversedCidr;
  });

  const outputFile = path.join(OUTPUT_INTERNAL_DIR, 'reversed-chn-cidr.txt');
  await mkdirp(OUTPUT_INTERNAL_DIR);

  const writeStream = fs.createWriteStream(outputFile);
  for (const line of reversedCidr) {
    const p = asyncWriteToStream(writeStream, line + '\n');
    if (p) {
      // eslint-disable-next-line no-await-in-loop -- stream high water mark
      await p;
    }
  }
  await asyncWriteToStream(writeStream, '\n');

  writeStream.end();
});
