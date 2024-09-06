import path from 'node:path';
import { task } from './trace';
import { compareAndWriteFile } from './lib/create-file';
import { DIRECTS, LANS } from '../Source/non_ip/direct';
import * as yaml from 'yaml';
import { writeFile } from './lib/misc';
import { OUTPUT_INTERNAL_DIR, OUTPUT_MODULES_DIR } from './constants/dir';

const HOSTNAMES = [
  // Network Detection, Captive Portal
  'msftncsi.com',
  'msftconnecttest.com',
  '*.msftncsi.com',
  '*.msftconnecttest.com',
  'network-test.debian.org',
  'detectportal.firefox.com',
  'resolver1.opendns.com',
  '*.ipv6.microsoft.com',
  // Handle SNAT conversation properly
  '*.srv.nintendo.net',
  '*.stun.playstation.net',
  'xbox.*.microsoft.com',
  '*.xboxlive.com',
  'turn.twilio.com',
  '*.turn.twilio.com',
  'stun.twilio.com',
  '*.stun.twilio.com',
  'stun.syncthing.net',
  'stun.*',
  'controlplane.tailscale.com',
  // NTP
  'time.*.com', 'time.*.gov, time.*.edu.cn, time.*.apple.com', 'time?.*.com', 'ntp.*.com', 'ntp?.*.com', '*.time.edu.cn', '*.ntp.org.cn', '*.pool.ntp.org', 'time*.cloud.tencent.com',
  // QQ Login
  'localhost.ptlogin2.qq.com',
  'localhost.sec.qq.com',
  'localhost.work.weixin.qq.com',
  // Microsoft Auto Discovery
  'PDC._msDCS.*.*',
  'DC._msDCS.*.*',
  'GC._msDCS.*.*',
  // Misc,
  '*.battlenet.com.cn',
  '*.blzstatic.cn',
  '*.battlenet.com'
];

export const buildAlwaysRealIPModule = task(require.main === module, __filename)(async (span) => {
  // Intranet, Router Setup, and mant more
  const dataset = [Object.entries(DIRECTS), Object.entries(LANS)];
  const surge = dataset.flatMap(data => data.flatMap(([, { domains }]) => domains.flatMap((domain) => [`*.${domain}`, domain])));
  const clash = dataset.flatMap(data => data.flatMap(([, { domains }]) => domains.map((domain) => `+.${domain}`)));

  return Promise.all([
    compareAndWriteFile(
      span,
      [
        '#!name=[Sukka] Always Real IP Plus',
        `#!desc=Last Updated: ${new Date().toISOString()}`,
        '',
        '[General]',
        `always-real-ip = %APPEND% ${HOSTNAMES.concat(surge).join(', ')}`
      ],
      path.resolve(OUTPUT_MODULES_DIR, 'sukka_common_always_realip.sgmodule')
    ),
    writeFile(
      path.join(OUTPUT_INTERNAL_DIR, 'clash_fake_ip_filter.yaml'),
      yaml.stringify(
        {
          dns: {
            'fake-ip-filter': HOSTNAMES.concat(clash)
          }
        },
        { version: '1.1' }
      )
    )
  ]);
});
