import { getAppleCdnDomainsPromise } from './build-apple-cdn';
import { getDomesticAndDirectDomainsRulesetPromise } from './build-domestic-direct-lan-ruleset-dns-mapping-module';
import { readFileIntoProcessedArray } from './lib/fetch-text-by-line';
import { task } from './trace';
import path from 'node:path';

import { ALL as AllStreamServices } from '../Source/stream';
import { getChnCidrPromise } from './build-chn-cidr';
import { getTelegramCIDRPromise } from './lib/get-telegram-backup-ip';
import { compareAndWriteFile } from './lib/create-file';
import { getMicrosoftCdnRulesetPromise } from './build-microsoft-cdn';
import { isTruthy, nullthrow } from 'foxts/guard';
import { appendArrayInPlace } from 'foxts/append-array-in-place';
import { OUTPUT_INTERNAL_DIR, OUTPUT_SURGE_DIR, SOURCE_DIR } from './constants/dir';
import { ClashOnlyRulesetOutput } from './lib/rules/ruleset';
import { getGlobalRulesetPromise } from './build-global-server-dns-mapping';

const POLICY_GROUPS: Array<[name: string, insertProxy: boolean, insertDirect: boolean]> = [
  ['Default Proxy', true, false],
  ['Global', true, true],
  ['Microsoft & Apple', true, true],
  ['Stream', true, false],
  ['Steam Download', true, true],
  ['Domestic', false, true],
  ['Final Match', true, true]
];

const steamDomainsPromise = readFileIntoProcessedArray(path.join(SOURCE_DIR, 'domainset/game-download.conf'));

/**
 * This only generates a simplified version, for under-used users only.
 */
export const buildSSPanelUIMAppProfile = task(require.main === module, __filename)(async (span) => {
  const streamRules = AllStreamServices.flatMap((i) => i.rules);
  const [streamCidrs4, streamCidrs6] = AllStreamServices.reduce<[cidr4: string[], cidr6: string[]]>((acc, i) => {
    if (i.ip) {
      appendArrayInPlace(acc[0], i.ip.v4);
      appendArrayInPlace(acc[1], i.ip.v6);
    }

    return acc;
  }, [[], []]);

  const [
    [domesticRules, directRules, lanRules],
    appleCdnDomains,
    [microsoftCdnDomains, microsoftCdnDomainSuffixes],
    appleCnRules,
    neteaseMusicRules,
    microsoftRules,
    appleRules,
    // streamRules,
    steamDomainset,
    [globalRules],
    telegramRules,
    [domesticCidrs4, domesticCidrs6],
    // [streamCidrs4, streamCidrs6],
    { ipcidr: telegramCidrs4, ipcidr6: telegramCidrs6 },
    rawLanCidrs
  ] = await Promise.all([
    // domestic - domains
    getDomesticAndDirectDomainsRulesetPromise(),
    getAppleCdnDomainsPromise(),
    getMicrosoftCdnRulesetPromise,
    readFileIntoProcessedArray(path.join(OUTPUT_SURGE_DIR, 'non_ip/apple_cn.conf')),
    readFileIntoProcessedArray(path.join(OUTPUT_SURGE_DIR, 'non_ip/neteasemusic.conf')),
    // microsoft & apple - domains
    readFileIntoProcessedArray(path.join(OUTPUT_SURGE_DIR, 'non_ip/microsoft.conf')),
    readFileIntoProcessedArray(path.join(OUTPUT_SURGE_DIR, 'non_ip/apple_services.conf')),
    // steam - domains
    steamDomainsPromise,
    // global - domains
    getGlobalRulesetPromise(),
    readFileIntoProcessedArray(path.join(OUTPUT_SURGE_DIR, 'non_ip/telegram.conf')),
    // domestic - ip cidr
    getChnCidrPromise(),
    // global - ip cidr
    getTelegramCIDRPromise,
    // lan - ip cidr
    readFileIntoProcessedArray(path.join(OUTPUT_SURGE_DIR, 'ip/lan.conf'))
  ] as const);

  const domestic = new ClashOnlyRulesetOutput(span, '_', 'non_ip')
    .addFromRuleset(domesticRules)
    .bulkAddDomainSuffix(appleCdnDomains)
    .bulkAddDomain(microsoftCdnDomains)
    .bulkAddDomainSuffix(microsoftCdnDomainSuffixes)
    .addFromRuleset(appleCnRules)
    .addFromRuleset(neteaseMusicRules);

  const microsoftApple = new ClashOnlyRulesetOutput(span, '_', 'non_ip')
    .addFromRuleset(microsoftRules)
    .addFromRuleset(appleRules);

  const stream = new ClashOnlyRulesetOutput(span, '_', 'non_ip')
    .addFromRuleset(streamRules);

  const steam = new ClashOnlyRulesetOutput(span, '_', 'non_ip')
    .addFromDomainset(steamDomainset);

  const global = new ClashOnlyRulesetOutput(span, '_', 'non_ip')
    .addFromRuleset(globalRules)
    .addFromRuleset(telegramRules);

  const direct = new ClashOnlyRulesetOutput(span, '_', 'non_ip')
    .addFromRuleset(directRules)
    .addFromRuleset(lanRules);

  const domesticCidr = new ClashOnlyRulesetOutput(span, '_', 'ip')
    .bulkAddCIDR4(domesticCidrs4)
    .bulkAddCIDR6(domesticCidrs6);

  const streamCidr = new ClashOnlyRulesetOutput(span, '_', 'ip')
    .bulkAddCIDR4(streamCidrs4)
    .bulkAddCIDR6(streamCidrs6);

  const telegramCidr = new ClashOnlyRulesetOutput(span, '_', 'ip')
    .bulkAddCIDR4(telegramCidrs4)
    .bulkAddCIDR6(telegramCidrs6);

  const lanCidrs = new ClashOnlyRulesetOutput(span, '_', 'ip')
    .addFromRuleset(rawLanCidrs);

  const output = generateAppProfile(
    ...(
      (await Promise.all([
        domestic.compile(),
        microsoftApple.compile(),
        stream.compile(),
        steam.compile(),
        global.compile(),
        direct.compile(),
        domesticCidr.compile(),
        streamCidr.compile(),
        telegramCidr.compile(),
        lanCidrs.compile()
      ])).map(output => nullthrow(output[0]))
    ) as [
      string[], string[], string[], string[], string[],
      string[], string[], string[], string[], string[]
    ]
  );

  await compareAndWriteFile(
    span,
    output,
    path.resolve(OUTPUT_INTERNAL_DIR, 'appprofile.php')
  );
});

function generateAppProfile(
  directDomains: string[],
  microsoftAppleDomains: string[],
  streamDomains: string[],
  steamDomains: string[],
  globalDomains: string[],

  lanDomains: string[],
  directCidrs: string[],
  streamCidrs: string[],
  globalCidrs: string[],
  lanCidrs: string[]
) {
  const redults = [
    '<?php',
    '',
    `// # Build ${new Date().toISOString()}`,
    '',
    'declare(strict_types=1);',
    '',
    '$_ENV[\'Clash_Config\'] = [',
    '    \'port\' => 7890,',
    '    \'socks-port\' => 7891,',
    '    \'allow-lan\' => false,',
    '    \'mode\' => \'Rule\',',
    '    \'ipv6\' => true,',
    '    \'log-level\' => \'error\',',
    '    \'external-controller\' => \'0.0.0.0:9090\',',
    '    \'tun\' => [',
    '      \'enable\' => true,',
    '      \'stack\' => \'system\',',
    '      \'auto-route\' => true,',
    '      \'auto-redir\' => true,',
    '      \'auto-detect-interface\' => true,',
    '      \'dns-hijack\' => [',
    '        \'8.8.8.8:53\',',
    '        \'any:53\',',
    '        \'tcp://8.8.8.8:53\',',
    '        \'tcp://any:53\',',
    '      ]',
    '    ]',
    '];',
    '',
    `$_ENV['Clash_Group_Indexes'] = [${JSON.stringify(POLICY_GROUPS.reduce<number[]>((acc, [, insertProxy], index) => {
      if (insertProxy) {
        acc.push(index);
      }
      return acc;
    }, [])).slice(1, -1)}];`,
    '$_ENV[\'Clash_Group_Config\'] = [',
    '    \'proxy-groups\' => ['
  ];

  appendArrayInPlace(
    redults,
    POLICY_GROUPS.flatMap(([name, insertProxy, insertDirect]) => [
      '        [',
      `            'name' => '${name}',`,
      '            \'type\' => \'select\',',
      '            \'proxies\' => [',
      insertProxy && name !== 'Default Proxy' && '                \'Default Proxy\',',
      insertDirect && '                \'DIRECT\',',
      '            ],',
      '        ],'
    ].filter(isTruthy))
  );

  appendArrayInPlace(
    redults,
    [
      '    ],',
      '    \'rules\' => ['
    ]
  );

  // domestic - domains
  appendArrayInPlace(
    redults,
    directDomains.map(line => `        '${line},Domestic',`)
  );

  // microsoft & apple - domains
  appendArrayInPlace(
    redults,
    microsoftAppleDomains.map(line => `        '${line},Microsoft & Apple',`)
  );

  // stream - domains
  appendArrayInPlace(
    redults,
    streamDomains.map(line => `        '${line},Stream',`)
  );
  // steam download - domains
  appendArrayInPlace(
    redults,
    steamDomains.map(line => `        '${line},Steam Download',`)
  );
  // global - domains
  appendArrayInPlace(
    redults,
    globalDomains.map(line => `        '${line},Global',`)
  );
  // microsoft & apple - ip cidr (nope)
  // lan - domains
  appendArrayInPlace(
    redults,
    lanDomains.map(line => `        '${line},DIRECT',`)
  );
  // stream - ip cidr
  appendArrayInPlace(
    redults,
    streamCidrs.map(line => `        '${line},Stream',`)
  );
  // global - ip cidr
  appendArrayInPlace(
    redults,
    globalCidrs.map(line => `        '${line},Global',`)
  );
  // domestic - ip cidr
  appendArrayInPlace(
    redults,
    directCidrs.map(line => `        '${line},Domestic',`)
  );
  // lan - ip cidr
  appendArrayInPlace(
    redults,
    lanCidrs.map(line => `        '${line},DIRECT',`)
  );
  // match
  appendArrayInPlace(
    redults,
    [
      '        \'MATCH,Final Match\',',
      '    ],',
      '];'
    ]
  );

  return redults;
}
