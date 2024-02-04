import { fetchRemoteTextByLine } from './lib/fetch-text-by-line';
import { processLineFromReadline } from './lib/process-line';
import path from 'path';
import { task } from './trace';

import { exclude, merge } from 'fast-cidr-tools';
import { getChnCidrPromise } from './build-chn-cidr';

// https://en.wikipedia.org/wiki/Reserved_IP_addresses
const RESERVED_IPV4_CIDR = [
  '0.0.0.0/8',
  '10.0.0.0/8',
  '100.64.0.0/10',
  '127.0.0.0/8',
  '169.254.0.0/16',
  '172.16.0.0/12',
  '192.0.0.0/24',
  '192.0.2.0/24',
  // 192.88.99.0 // is currently being broadcast by HE and Comcast
  '192.168.0.0/16',
  '198.18.0.0/15',
  '198.51.100.0/24',
  '203.0.113.0/24',
  '224.0.0.0/4',
  '233.252.0.0/24',
  '240.0.0.0/4'
];

export const buildInternalReverseChnCIDR = task(import.meta.path, async (span) => {
  const cidrPromise = getChnCidrPromise();
  const peeked = Bun.peek(cidrPromise);
  const cidr: string[] = peeked === cidrPromise
    ? await span.traceChildPromise('download chnroutes2', cidrPromise)
    : (peeked as string[]);

  const reversedCidr = span.traceChildSync('build reversed chn cidr', () => merge(
    exclude(
      ['0.0.0.0/0'],
      RESERVED_IPV4_CIDR.concat(cidr),
      true
    ).concat([
      // https://github.com/misakaio/chnroutes2/issues/25
      '223.118.0.0/15',
      '223.120.0.0/15'
    ])
  ));

  return Bun.write(path.resolve(import.meta.dir, '../List/internal/reversed-chn-cidr.txt'), `${reversedCidr.join('\n')}\n`);
});

if (import.meta.main) {
  buildInternalReverseChnCIDR();
}
