import { fetchRemoteTextByLine } from './lib/fetch-text-by-line';
import { resolve as pathResolve } from 'path';
import { compareAndWriteFile, withBannerArray } from './lib/create-file';
import { processLineFromReadline } from './lib/process-line';
import { task, traceAsync, traceSync } from './lib/trace-runner';

import { exclude } from 'fast-cidr-tools';
import picocolors from 'picocolors';
import { createMemoizedPromise } from './lib/memo-promise';

// https://github.com/misakaio/chnroutes2/issues/25
const EXCLUDE_CIDRS = [
  '223.118.0.0/15',
  '223.120.0.0/15'
];

const INCLUDE_CIDRS = [
  '211.99.96.0/19' // wy.com.cn
];

export const getChnCidrPromise = createMemoizedPromise(async () => {
  const cidr = await traceAsync(
    picocolors.gray('download chnroutes2'),
    async () => processLineFromReadline(await fetchRemoteTextByLine('https://raw.githubusercontent.com/misakaio/chnroutes2/master/chnroutes.txt')),
    picocolors.gray
  );
  return traceSync(
    picocolors.gray('processing chnroutes2'),
    () => exclude([...cidr, ...INCLUDE_CIDRS], EXCLUDE_CIDRS, true),
    picocolors.gray
  );
});

export const buildChnCidr = task(import.meta.path, async () => {
  const filteredCidr = await getChnCidrPromise();

  // Can not use SHARED_DESCRIPTION here as different license
  const description = [
    'License: CC BY-SA 2.0',
    'Homepage: https://ruleset.skk.moe',
    'GitHub: https://github.com/SukkaW/Surge',
    '',
    'Data from https://misaka.io (misakaio @ GitHub)'
  ];

  // Can not use createRuleset here, as Clash support advanced ipset syntax
  return Promise.all([
    compareAndWriteFile(
      withBannerArray(
        'Sukka\'s Ruleset - Mainland China IPv4 CIDR',
        description,
        new Date(),
        filteredCidr.map(i => `IP-CIDR,${i}`)
      ),
      pathResolve(import.meta.dir, '../List/ip/china_ip.conf')
    ),
    compareAndWriteFile(
      withBannerArray(
        'Sukka\'s Ruleset - Mainland China IPv4 CIDR',
        description,
        new Date(),
        filteredCidr
      ),
      pathResolve(import.meta.dir, '../Clash/ip/china_ip.txt')
    )
  ]);
});

if (import.meta.main) {
  buildChnCidr();
}
