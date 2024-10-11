import path from 'node:path';
import { task } from './trace';
import { compareAndWriteFile } from './lib/create-file';
import { DIRECTS, LANS } from '../Source/non_ip/direct';
import * as yaml from 'yaml';
import { OUTPUT_INTERNAL_DIR, OUTPUT_MODULES_DIR } from './constants/dir';
import { appendArrayInPlace } from './lib/append-array-in-place';

const HOSTNAMES = [
  // Network Detection, Captive Portal
  'dns.msftncsi.com',
  // '*.msftconnecttest.com',
  // 'network-test.debian.org',
  // 'detectportal.firefox.com',
  // Handle SNAT conversation properly
  '*.srv.nintendo.net',
  '*.stun.playstation.net',
  'xbox.*.microsoft.com',
  '*.xboxlive.com',
  '*.turn.twilio.com',
  '*.stun.twilio.com',
  // 'stun.syncthing.net',
  'stun.*',
  // 'controlplane.tailscale.com',
  // NTP
  'time.*.com', 'time.*.gov', 'time.*.edu.cn', 'time.*.apple.com', 'time?.*.com', 'ntp.*.com', 'ntp?.*.com', '*.time.edu.cn', '*.ntp.org.cn', '*.pool.ntp.org'
  // 'time*.cloud.tencent.com', 'ntp?.aliyun.com',
  // QQ Login
  // 'localhost.*.qq.com'
  // 'localhost.ptlogin2.qq.com
  // 'localhost.sec.qq.com',
  // 'localhost.work.weixin.qq.com',
];

export const buildAlwaysRealIPModule = task(require.main === module, __filename)(async (span) => {
  // Intranet, Router Setup, and mant more
  const dataset = [
    DIRECTS.HOTSPOT_CAPTIVE_PORTAL,
    DIRECTS.SYSTEM,
    ...Object.values(LANS)
  ];
  const surge = dataset.flatMap(({ domains }) => domains.flatMap((domain) => {
    switch (domain[0]) {
      case '+':
        return [`*.${domain.slice(1)}`];
      case '$':
        return [domain.slice(1)];
      default:
        return [domain, `*.${domain}`];
    }
  }));

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
    compareAndWriteFile(
      span,
      yaml.stringify(
        {
          dns: {
            'fake-ip-filter': appendArrayInPlace(
              /** clash */
              dataset.flatMap(({ domains }) => domains.map((domain) => `+.${domain}`)),
              HOSTNAMES
            )
          }
        },
        { version: '1.1' }
      ).split('\n'),
      path.join(OUTPUT_INTERNAL_DIR, 'clash_fake_ip_filter.yaml')
    )
  ]);
});
