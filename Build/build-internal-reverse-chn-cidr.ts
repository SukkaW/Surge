import { task } from './trace';

import { getChnCidrPromise } from './build-chn-cidr';
import Worktank from 'worktank';

const pool = new Worktank({
  name: 'build-internal-reverse-chn-cidr',
  size: 1,
  timeout: 10000, // The maximum number of milliseconds to wait for the result from the worker, if exceeded the worker is terminated and the execution promise rejects
  warmup: true,
  autoterminate: 30000, // The interval of milliseconds at which to check if the pool can be automatically terminated, to free up resources, workers will be spawned up again if needed
  env: {},
  methods: {
    // eslint-disable-next-line object-shorthand -- workertank
    getreversedCidr: async function (cidr: string[], importMetaUrl: string): Promise<void> {
      // TODO: createRequire is a temporary workaround for https://github.com/nodejs/node/issues/51956
      const { default: module } = await import('node:module');
      const __require = module.createRequire(importMetaUrl);
      const path = __require('node:path') as typeof import('node:path');
      const fs = __require('fs') as typeof import('fs');

      const { OUTPUT_INTERNAL_DIR } = __require('./constants/dir') as typeof import('./constants/dir');
      const { exclude, merge } = __require('fast-cidr-tools') as typeof import('fast-cidr-tools');
      const { RESERVED_IPV4_CIDR, NON_CN_CIDR_INCLUDED_IN_CHNROUTE } = __require('./constants/cidr') as typeof import('./constants/cidr');
      const { appendArrayInPlace } = __require('./lib/append-array-in-place') as typeof import('./lib/append-array-in-place');
      const { fastStringArrayJoin } = __require('foxts/fast-string-array-join') as typeof import('foxts/fast-string-array-join');

      const outputFile = path.join(OUTPUT_INTERNAL_DIR, 'reversed-chn-cidr.txt');

      fs.mkdirSync(OUTPUT_INTERNAL_DIR, { recursive: true });

      const result = merge(
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

      fs.writeFileSync(outputFile, fastStringArrayJoin(result, '\n') + '\n', { encoding: 'utf-8' });
    }
  }
});

export const buildInternalReverseChnCIDR = task(require.main === module, __filename)(async (span) => {
  const [cidr] = await span.traceChildPromise('download chnroutes2', getChnCidrPromise());

  return span.traceChildAsync(
    'build reversed chn cidr',
    async () => pool.exec(
      'getreversedCidr',
      [cidr, import.meta.url]
    ).finally(() => pool.terminate())
  );
});
