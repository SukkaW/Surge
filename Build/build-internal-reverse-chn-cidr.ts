import path from 'path';
import { task } from './trace';

import { exclude, merge } from 'fast-cidr-tools';
import { getChnCidrPromise } from './build-chn-cidr';
import { NON_CN_CIDR_INCLUDED_IN_CHNROUTE, RESERVED_IPV4_CIDR } from './constants/cidr';

export const buildInternalReverseChnCIDR = task(import.meta.main, import.meta.path)(async () => {
  const cidrPromise = getChnCidrPromise();
  const peeked = Bun.peek(cidrPromise);
  const cidr: string[] = peeked === cidrPromise
    ? await cidrPromise
    : (peeked as string[]);

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

  return Bun.write(path.resolve(import.meta.dir, '../Internal/reversed-chn-cidr.txt'), `${reversedCidr.join('\n')}\n`);
});
