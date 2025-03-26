import path from 'node:path';
import { task } from './trace';
import { compareAndWriteFile } from './lib/create-file';
import { DIRECTS, LAN } from '../Source/non_ip/direct';
import type { DNSMapping } from '../Source/non_ip/direct';
import { DOMESTICS, DOH_BOOTSTRAP } from '../Source/non_ip/domestic';
import * as yaml from 'yaml';
import { OUTPUT_INTERNAL_DIR, OUTPUT_MODULES_DIR } from './constants/dir';
import { appendArrayInPlace } from './lib/append-array-in-place';
import { SHARED_DESCRIPTION } from './constants/description';
import { createGetDnsMappingRule } from './build-domestic-direct-lan-ruleset-dns-mapping-module';
import { ClashDomainSet } from './lib/writing-strategy/clash';
import { FileOutput } from './lib/rules/base';

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
  'stun.syncthing.net',
  'stun.*',
  // 'controlplane.tailscale.com',
  // NTP
  // 'time.*.com', 'time.*.gov', 'time.*.edu.cn', 'time.*.apple.com', 'time?.*.com', 'ntp.*.com', 'ntp?.*.com', '*.time.edu.cn', '*.ntp.org.cn', '*.pool.ntp.org'
  // 'time*.cloud.tencent.com', 'ntp?.aliyun.com',
  // QQ Login
  // 'localhost.*.qq.com'
  // 'localhost.ptlogin2.qq.com
  // 'localhost.sec.qq.com',
  // 'localhost.work.weixin.qq.com',
  '*.sslip.io',
  '*.nip.io'
];

export const buildAlwaysRealIPModule = task(require.main === module, __filename)(async (span) => {
  const surge: string[] = [];
  const clashFakeIpFilter = new FileOutput(span, 'clash_fake_ip_filter')
    .withTitle('Sukka\'s Ruleset - Always Real IP Plus')
    .withDescription([
      ...SHARED_DESCRIPTION,
      '',
      'Clash.Meta fake-ip-filter as ruleset'
    ])
    .withStrategies([
      new ClashDomainSet('domainset')
    ]);

  // Intranet, Router Setup, and mant more
  const dataset = [DIRECTS, LAN, DOMESTICS, DOH_BOOTSTRAP].reduce<DNSMapping[]>((acc, item) => {
    Object.values(item).forEach((i: DNSMapping) => {
      if (i.realip) {
        acc.push(i);
      }
    });

    return acc;
  }, []);

  const getDnsMappingRuleWithoutWildcard = createGetDnsMappingRule(false);

  for (const { domains } of dataset) {
    clashFakeIpFilter.addFromRuleset(domains.flatMap(getDnsMappingRuleWithoutWildcard));
  }

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
