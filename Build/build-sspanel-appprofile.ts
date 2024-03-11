import { getAppleCdnDomainsPromise } from './build-apple-cdn';
import { getDomesticDomainsRulesetPromise } from './build-domestic-ruleset';
import { surgeRulesetToClashClassicalTextRuleset, surgeDomainsetToClashRuleset } from './lib/clash';
import { readFileIntoProcessedArray } from './lib/fetch-text-by-line';
import { task } from './trace';
import path from 'path';

import { ALL as AllStreamServices } from '../Source/stream';
import { getChnCidrPromise } from './build-chn-cidr';
import { getTelegramCIDRPromise } from './build-telegram-cidr';
import { compareAndWriteFile } from './lib/create-file';
import { getMicrosoftCdnRulesetPromise } from './build-microsoft-cdn';

const POLICY_GROUPS: Array<[name: string, insertProxy: boolean, insertDirect: boolean]> = [
  ['Default Proxy', true, false],
  ['Global', true, true],
  ['Microsoft & Apple', true, true],
  ['Stream', true, false],
  ['Steam Download', true, true],
  ['Domestic', false, true],
  ['Final Match', true, true]
];

const removeNoResolved = (line: string) => line.replace(',no-resolve', '');

/**
 * This only generates a simplified version, for under-used users only.
 */
export const buildSSPanelUIMAppProfile = task(import.meta.path, async (span) => {
  const [
    domesticDomains,
    appleCdnDomains,
    microsoftCdnDomains,
    appleCnDomains,
    neteaseMusicDomains,
    microsoftDomains,
    appleDomains,
    streamDomains,
    steamDomains,
    globalDomains,
    telegramDomains,
    lanDomains,
    domesticCidrs,
    streamCidrs,
    { results: rawTelegramCidrs },
    lanCidrs
  ] = await Promise.all([
    // domestic - domains
    getDomesticDomainsRulesetPromise().then(surgeRulesetToClashClassicalTextRuleset),
    getAppleCdnDomainsPromise().then(domains => domains.map(domain => `DOMAIN-SUFFIX,${domain}`)),
    getMicrosoftCdnRulesetPromise().then(surgeRulesetToClashClassicalTextRuleset),
    readFileIntoProcessedArray(path.resolve(import.meta.dir, '../Source/non_ip/apple_cn.conf')),
    readFileIntoProcessedArray(path.resolve(import.meta.dir, '../Source/non_ip/neteasemusic.conf')).then(surgeRulesetToClashClassicalTextRuleset),
    // microsoft & apple - domains
    readFileIntoProcessedArray(path.resolve(import.meta.dir, '../Source/non_ip/microsoft.conf')),
    readFileIntoProcessedArray(path.resolve(import.meta.dir, '../Source/non_ip/apple_services.conf')).then(surgeRulesetToClashClassicalTextRuleset),
    // stream - domains
    surgeRulesetToClashClassicalTextRuleset(AllStreamServices.flatMap((i) => i.rules)),
    // steam - domains
    readFileIntoProcessedArray(path.resolve(import.meta.dir, '../Source/domainset/steam.conf')).then(surgeDomainsetToClashRuleset),
    // global - domains
    readFileIntoProcessedArray(path.resolve(import.meta.dir, '../Source/non_ip/global.conf')).then(surgeRulesetToClashClassicalTextRuleset),
    readFileIntoProcessedArray(path.resolve(import.meta.dir, '../Source/non_ip/telegram.conf')).then(surgeRulesetToClashClassicalTextRuleset),
    // lan - domains
    readFileIntoProcessedArray(path.resolve(import.meta.dir, '../Source/non_ip/lan.conf')),
    // domestic - ip cidr
    getChnCidrPromise().then(cidrs => cidrs.map(cidr => `IP-CIDR,${cidr}`)),
    AllStreamServices.flatMap((i) => (
      i.ip
        ? [
          ...i.ip.v4.map((ip) => `IP-CIDR,${ip}`),
          ...i.ip.v6.map((ip) => `IP-CIDR6,${ip}`)
        ]
        : []
    )),
    // global - ip cidr
    getTelegramCIDRPromise(),
    // lan - ip cidr
    readFileIntoProcessedArray(path.resolve(import.meta.dir, '../Source/ip/lan.conf'))
  ] as const);

  const telegramCidrs = rawTelegramCidrs.map(removeNoResolved);

  const output = generateAppProfile(
    [
      ...domesticDomains,
      ...appleCdnDomains,
      ...microsoftCdnDomains,
      ...appleCnDomains,
      ...neteaseMusicDomains
    ],
    [
      ...microsoftDomains,
      ...appleDomains
    ],
    streamDomains,
    steamDomains,
    [
      ...globalDomains,
      ...telegramDomains
    ],
    lanDomains,
    domesticCidrs,
    streamCidrs,
    [
      ...telegramCidrs
    ],
    lanCidrs
  );

  await compareAndWriteFile(
    span,
    output,
    path.resolve(import.meta.dir, '../List/internal/appprofile.php')
  );
});

if (import.meta.main) {
  buildSSPanelUIMAppProfile();
}

const isTruthy = <T>(i: T | 0 | '' | false | null | undefined): i is T => !!i;

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
  return [
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
    '    \'proxy-groups\' => [',
    ...POLICY_GROUPS.flatMap(([name, insertProxy, insertDirect]) => {
      return [
        '        [',
        `            'name' => '${name}',`,
        '            \'type\' => \'select\',',
        '            \'proxies\' => [',
        insertProxy && name !== 'Default Proxy' && '                \'Default Proxy\',',
        insertDirect && '                \'DIRECT\',',
        '            ],',
        '        ],'
      ].filter(isTruthy);
    }),
    '    ],',
    '    \'rules\' => [',
    // domestic - domains
    ...directDomains.map(line => `        '${line},Domestic',`),
    // microsoft & apple - domains
    ...microsoftAppleDomains.map(line => `        '${line},Microsoft & Apple',`),
    // stream - domains
    ...streamDomains.map(line => `        '${line},Stream',`),
    // steam download - domains
    ...steamDomains.map(line => `        '${line},Steam Download',`),
    // global - domains
    ...globalDomains.map(line => `        '${line},Global',`),
    // microsoft & apple - ip cidr (nope)
    // lan - domains
    ...lanDomains.map(line => `        '${line},DIRECT',`),
    // stream - ip cidr
    ...streamCidrs.map(line => `        '${line},Stream',`),
    // global - ip cidr
    ...globalCidrs.map(line => `        '${line},Global',`),
    // domestic - ip cidr
    ...directCidrs.map(line => `        '${line},Domestic',`),
    // lan - ip cidr
    ...lanCidrs.map(line => `        '${line},DIRECT',`),
    // match
    '        \'MATCH,Final Match\',',
    '    ],',
    '];'
  ];
}
