import { fetchRemoteTextByLine } from './lib/fetch-text-by-line';
import { processLineFromReadline } from './lib/process-line';
import { task } from './trace';

import { exclude } from 'fast-cidr-tools';
import { createMemoizedPromise } from './lib/memo-promise';
import { CN_CIDR_NOT_INCLUDED_IN_CHNROUTE, NON_CN_CIDR_INCLUDED_IN_CHNROUTE } from './constants/cidr';
import { appendArrayInPlace } from './lib/append-array-in-place';
import { IPListOutput } from './lib/create-file';

export const getChnCidrPromise = createMemoizedPromise(async () => {
  const [cidr4, cidr6] = await Promise.all([
    fetchRemoteTextByLine('https://raw.githubusercontent.com/misakaio/chnroutes2/master/chnroutes.txt').then(processLineFromReadline),
    fetchRemoteTextByLine('https://gaoyifan.github.io/china-operator-ip/china6.txt').then(processLineFromReadline)
  ]);

  appendArrayInPlace(cidr4, CN_CIDR_NOT_INCLUDED_IN_CHNROUTE);
  return [exclude(cidr4, NON_CN_CIDR_INCLUDED_IN_CHNROUTE, true), cidr6] as const;
});

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
