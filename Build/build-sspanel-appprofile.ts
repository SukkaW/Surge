import { getAppleCdnDomainsPromise } from './build-apple-cdn';
import { getDomesticDomainsRulesetPromise } from './build-domestic-ruleset';
import { surgeRulesetToClashClassicalTextRuleset } from './lib/clash';
import { readFileByLine } from './lib/fetch-text-by-line';
import { processLineFromReadline } from './lib/process-line';
import { task } from './lib/trace-runner';
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
  ['Domestic', false, true],
  ['Final Match', true, true]
];

const removeNoResolved = (line: string) => line.replace(',no-resolve', '');

/**
 * This only generates a simplified version, for under-used users only.
 */
export const buildSSPanelUIMAppProfile = task(import.meta.path, async () => {
  const [
    domesticDomains,
    appleCdnDomains,
    microsoftCdnDomains,
    appleCnDomains,
    neteaseMusicDomains,
    microsoftDomains,
    appleDomains,
    streamDomains,
    globalDomains,
    globalPlusDomains,
    telegramDomains,
    domesticCidrs,
    streamCidrs,
    { results: rawTelegramCidrs }
  ] = await Promise.all([
    // domestic - domains
    getDomesticDomainsRulesetPromise().then(surgeRulesetToClashClassicalTextRuleset),
    getAppleCdnDomainsPromise().then(domains => domains.map(domain => `DOMAIN-SUFFIX,${domain}`)),
    getMicrosoftCdnRulesetPromise().then(surgeRulesetToClashClassicalTextRuleset),
    processLineFromReadline(readFileByLine(path.resolve(import.meta.dir, '../Source/non_ip/apple_cn.conf'))),
    processLineFromReadline(readFileByLine(path.resolve(import.meta.dir, '../Source/non_ip/neteasemusic.conf'))).then(surgeRulesetToClashClassicalTextRuleset),
    // microsoft & apple - domains
    processLineFromReadline(readFileByLine(path.resolve(import.meta.dir, '../Source/non_ip/microsoft.conf'))),
    (processLineFromReadline(readFileByLine(path.resolve(import.meta.dir, '../Source/non_ip/apple_services.conf')))).then(surgeRulesetToClashClassicalTextRuleset),
    // stream - domains
    surgeRulesetToClashClassicalTextRuleset(AllStreamServices.flatMap((i) => i.rules)),
    // global - domains
    processLineFromReadline(readFileByLine(path.resolve(import.meta.dir, '../Source/non_ip/global.conf'))).then(surgeRulesetToClashClassicalTextRuleset),
    processLineFromReadline(readFileByLine(path.resolve(import.meta.dir, '../Source/non_ip/global_plus.conf'))).then(surgeRulesetToClashClassicalTextRuleset),
    processLineFromReadline(readFileByLine(path.resolve(import.meta.dir, '../Source/non_ip/telegram.conf'))).then(surgeRulesetToClashClassicalTextRuleset),
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
    getTelegramCIDRPromise()
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
    [
      ...globalDomains,
      ...globalPlusDomains,
      ...telegramDomains
    ],
    domesticCidrs,
    streamCidrs,
    [
      ...telegramCidrs
    ]
  );

  await compareAndWriteFile(
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
  globalDomains: string[],
  directCidrs: string[],
  streamCidrs: string[],
  globalCidrs: string[]
) {
  const result: string[] = [];

  result.push(
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
    // global - domains
    ...globalDomains.map(line => `        '${line},Global',`),
    // microsoft & apple - ip cidr (nope)
    // stream - ip cidr
    ...streamCidrs.map(line => `        '${line},Stream',`),
    // global - ip cidr
    ...globalCidrs.map(line => `        '${line},Global',`),
    // domestic - ip cidr
    ...directCidrs.map(line => `        '${line},Domestic',`),
    // match
    '        \'MATCH,Final Match\',',
    '    ],',
    '];'
  );

  return result;
}
