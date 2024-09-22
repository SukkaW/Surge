import path from 'node:path';
import { task } from './trace';

import { exclude, merge } from 'fast-cidr-tools';
import { getChnCidrPromise } from './build-chn-cidr';
import { NON_CN_CIDR_INCLUDED_IN_CHNROUTE, RESERVED_IPV4_CIDR } from './constants/cidr';

import fs from 'node:fs';
import { OUTPUT_INTERNAL_DIR } from './constants/dir';
import { asyncWriteToStream } from './lib/async-write-to-stream';
import { mkdirp } from './lib/misc';
import { appendArrayInPlace } from './lib/append-array-in-place';

export const buildInternalReverseChnCIDR = task(require.main === module, __filename)(async () => {
  const [cidr] = await getChnCidrPromise();

  const reversedCidr = merge(
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
