import { getAppleCdnDomainsPromise } from './build-apple-cdn';
import { getDomesticAndDirectDomainsRulesetPromise } from './build-domestic-direct-lan-ruleset-dns-mapping-module';
import { surgeRulesetToClashClassicalTextRuleset, surgeDomainsetToClashRuleset } from './lib/clash';
import { readFileIntoProcessedArray } from './lib/fetch-text-by-line';
import { task } from './trace';
import path from 'path';

import { ALL as AllStreamServices } from '../Source/stream';
import { getChnCidrPromise } from './build-chn-cidr';
import { getTelegramCIDRPromise } from './build-telegram-cidr';
import { compareAndWriteFile } from './lib/create-file';
import { getMicrosoftCdnRulesetPromise } from './build-microsoft-cdn';
import { isTruthy } from './lib/misc';
import { appendArrayInPlace } from './lib/append-array-in-place';

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
export const buildSSPanelUIMAppProfile = task(require.main === module, __filename)(async (span) => {
  const [
    [domesticDomains, directDomains, lanDomains],
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
    domesticCidrs,
    streamCidrs,
    { results: rawTelegramCidrs },
    lanCidrs
  ] = await Promise.all([
    // domestic - domains
    getDomesticAndDirectDomainsRulesetPromise()
      .then(
        data => (
          data.map(surgeRulesetToClashClassicalTextRuleset)
        ) as [string[], string[], string[]]
      ),
    getAppleCdnDomainsPromise().then(domains => domains.map(domain => `DOMAIN-SUFFIX,${domain}`)),
    getMicrosoftCdnRulesetPromise().then(surgeRulesetToClashClassicalTextRuleset),
    readFileIntoProcessedArray(path.resolve(__dirname, '../Source/non_ip/apple_cn.conf')),
    readFileIntoProcessedArray(path.resolve(__dirname, '../Source/non_ip/neteasemusic.conf')).then(surgeRulesetToClashClassicalTextRuleset),
    // microsoft & apple - domains
    readFileIntoProcessedArray(path.resolve(__dirname, '../Source/non_ip/microsoft.conf')),
    readFileIntoProcessedArray(path.resolve(__dirname, '../Source/non_ip/apple_services.conf')).then(surgeRulesetToClashClassicalTextRuleset),
    // stream - domains
    surgeRulesetToClashClassicalTextRuleset(AllStreamServices.flatMap((i) => i.rules)),
    // steam - domains
    readFileIntoProcessedArray(path.resolve(__dirname, '../Source/domainset/steam.conf')).then(surgeDomainsetToClashRuleset),
    // global - domains
    readFileIntoProcessedArray(path.resolve(__dirname, '../Source/non_ip/global.conf')).then(surgeRulesetToClashClassicalTextRuleset),
    readFileIntoProcessedArray(path.resolve(__dirname, '../Source/non_ip/telegram.conf')).then(surgeRulesetToClashClassicalTextRuleset),
    // domestic - ip cidr
    getChnCidrPromise().then(([cidrs4, cidrs6]) => [
      ...cidrs4.map(cidr => `IP-CIDR,${cidr}`),
      ...cidrs6.map(cidr => `IP-CIDR,${cidr}`)
    ]),
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
    readFileIntoProcessedArray(path.resolve(__dirname, '../Source/ip/lan.conf'))
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
    [
      ...directDomains,
      ...lanDomains
    ],
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
    path.resolve(__dirname, '../Internal/appprofile.php')
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
    POLICY_GROUPS.flatMap(([name, insertProxy, insertDirect]) => {
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
    })
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
