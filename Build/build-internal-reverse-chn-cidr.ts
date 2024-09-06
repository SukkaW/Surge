import path from 'node:path';
import { task } from './trace';

import { exclude, merge } from 'fast-cidr-tools';
import { getChnCidrPromise } from './build-chn-cidr';
import { NON_CN_CIDR_INCLUDED_IN_CHNROUTE, RESERVED_IPV4_CIDR } from './constants/cidr';

import { writeFile } from './lib/misc';
import { OUTPUT_INTERNAL_DIR } from './constants/dir';

export const buildInternalReverseChnCIDR = task(require.main === module, __filename)(async () => {
  const [cidr] = await getChnCidrPromise();

  const reversedCidr = merge(
    exclude(
      ['0.0.0.0/0'],
      RESERVED_IPV4_CIDR.concat(cidr),
      true
    ).concat(
      // https://github.com/misakaio/chnroutes2/issues/25
      NON_CN_CIDR_INCLUDED_IN_CHNROUTE
    )
  );

  const outputFile = path.join(OUTPUT_INTERNAL_DIR, 'reversed-chn-cidr.txt');

  return writeFile(
    outputFile,
    reversedCidr.join('\n') + '\n'
  );
});
