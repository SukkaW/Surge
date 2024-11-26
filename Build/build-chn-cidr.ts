import { fetchRemoteTextByLine } from './lib/fetch-text-by-line';
import { task } from './trace';

import { contains as containsCidr, exclude as excludeCidr } from 'fast-cidr-tools';
import { createMemoizedPromise } from './lib/memo-promise';
import { CN_CIDR_MISSING_IN_CHNROUTE, NON_CN_CIDR_INCLUDED_IN_CHNROUTE } from './constants/cidr';
import { appendArrayInPlace } from './lib/append-array-in-place';
import { IPListOutput } from './lib/create-file';
import { cachedOnlyFail } from './lib/fs-memo';

const PROBE_CHN_CIDR_V4 = [
  // NetEase Hangzhou
  '223.252.196.38',
  // Aliyun ShenZhen
  '120.78.92.171'
];

export const getChnCidrPromise = createMemoizedPromise(cachedOnlyFail(
  async function getChnCidr() {
    const [_cidr4, cidr6] = await Promise.all([
      fetchRemoteTextByLine('https://raw.githubusercontent.com/misakaio/chnroutes2/master/chnroutes.txt', true).then(Array.fromAsync<string>),
      fetchRemoteTextByLine('https://gaoyifan.github.io/china-operator-ip/china6.txt', true).then(Array.fromAsync<string>)
    ]);

    const cidr4 = excludeCidr(
      appendArrayInPlace(_cidr4, CN_CIDR_MISSING_IN_CHNROUTE),
      NON_CN_CIDR_INCLUDED_IN_CHNROUTE,
      true
    );

    for (const probeIp of PROBE_CHN_CIDR_V4) {
      if (!containsCidr(cidr4, PROBE_CHN_CIDR_V4)) {
        const err = new TypeError('chnroutes missing probe IP');
        err.cause = probeIp;
        throw err;
      }
    }

    return [cidr4, cidr6] as const;
  },
  {
    serializer: JSON.stringify,
    deserializer: JSON.parse
  }
));

export const buildChnCidr = task(require.main === module, __filename)(async (span) => {
  const [filteredCidr4, cidr6] = await span.traceChildAsync('download chnroutes2', getChnCidrPromise);

  // Can not use SHARED_DESCRIPTION here as different license
  const description = [
    'License: CC BY-SA 2.0',
    'Homepage: https://ruleset.skk.moe',
    'GitHub: https://github.com/SukkaW/Surge',
    ''
  ];

  return Promise.all([
    new IPListOutput(span, 'china_ip', false)
      .withTitle('Sukka\'s Ruleset - Mainland China IPv4 CIDR')
      .withDescription([
        ...description,
        'Data from https://misaka.io (misakaio @ GitHub)'
      ])
      .bulkAddCIDR4(filteredCidr4)
      .write(),
    new IPListOutput(span, 'china_ip_ipv6', false)
      .withTitle('Sukka\'s Ruleset - Mainland China IPv6 CIDR')
      .withDescription([
        ...description,
        'Data from https://github.com/gaoyifan/china-operator-ip'
      ])
      .bulkAddCIDR6(cidr6)
      .write()
  ]);
});
