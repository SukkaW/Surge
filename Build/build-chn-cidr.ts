import { fetchRemoteTextAndCreateReadlineInterface } from './lib/fetch-remote-text-by-line';
import { resolve as pathResolve } from 'path';
import { compareAndWriteFile, withBannerArray } from './lib/create-file';
import { processLineFromReadline } from './lib/process-line';
import { task } from './lib/trace-runner';

import { exclude } from 'fast-cidr-tools';

// https://github.com/misakaio/chnroutes2/issues/25
const EXCLUDE_CIDRS = [
  '223.118.0.0/15',
  '223.120.0.0/15'
];

const INCLUDE_CIDRS = [
  '211.99.96.0/19' // wy.com.cn
];

export const buildChnCidr = task(import.meta.path, async () => {
  const cidr = await processLineFromReadline(await fetchRemoteTextAndCreateReadlineInterface('https://raw.githubusercontent.com/misakaio/chnroutes2/master/chnroutes.txt'));
  const filteredCidr = exclude([...cidr, ...INCLUDE_CIDRS], EXCLUDE_CIDRS, true);

  // Can not use SHARED_DESCRIPTION here as different license
  const description = [
    'License: CC BY-SA 2.0',
    'Homepage: https://ruleset.skk.moe',
    'GitHub: https://github.com/SukkaW/Surge',
    '',
    'Data from https://misaka.io (misakaio @ GitHub)'
  ];

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
