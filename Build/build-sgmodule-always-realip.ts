import path from 'path';
import { task } from './trace';
import { compareAndWriteFile } from './lib/create-file';

const HOSTNAMES = [
  // Intranet
  '*.lan',
  '*.localdomain',
  '*.localhost',
  '*.home.arpa',
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
  'stun.*.*',
  'stun.*.*.*',
  'controlplane.tailscale.com',
  // NTP
  'time.*.com', 'time.*.gov, time.*.edu.cn, time.*.apple.com', 'time1.*.com', 'time2.*.com', 'time3.*.com', 'time4.*.com', 'time5.*.com', 'time6.*.com', 'time7.*.com', 'time8.*.com', 'time9.*.com, ntp.*.com, ntp1.*.com, ntp2.*.com, ntp3.*.com, ntp4.*.com, ntp5.*.com, ntp6.*.com, ntp7.*.com', 'time1.*.com', 'time2.*.com', 'time3.*.com', 'time4.*.com', 'time5.*.com', 'time6.*.com', 'time7.*.com', 'time8.*.com', 'ti me9.*.com', '*.time.edu.cn', '*.ntp.org.cn', '*.pool.ntp.org', 'time1.cloud.tencent.com',
  // AdGuard
  'local.adguard.org',
  'injections.adguard.org',
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
] as const;

export const buildAlwaysRealIPModule = task(import.meta.main, import.meta.path)(async (span) => {
  return compareAndWriteFile(
    span,
    [
      '#!name=[Sukka] Always Real IP Plus',
      `#!desc=Last Updated: ${new Date().toISOString()}`,
      '',
      '[General]',
      `always-real-ip = %APPEND% ${HOSTNAMES.join(', ')}`
    ],
    path.resolve(import.meta.dir, '../Modules/sukka_common_always_realip.sgmodule')
  );
});
