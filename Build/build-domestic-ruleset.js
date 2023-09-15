// @ts-check
const path = require('path');
const { DOMESTICS } = require('../Source/non_ip/domestic');
const { readFileByLine } = require('./lib/fetch-remote-text-by-line');
const { processLineFromReadline } = require('./lib/process-line');
const { compareAndWriteFile, createRuleset } = require('./lib/create-file');
const { task } = require('./lib/trace-runner');

const buildDomesticRuleset = task(__filename, async () => {
  const results = await processLineFromReadline(readFileByLine(path.resolve(__dirname, '../Source/non_ip/domestic.conf')));

  results.push(
    ...Object.entries(DOMESTICS)
      .reduce(
        (acc, [key, { domains }]) => {
          if (key === 'SYSTEM') return acc;
          return [...acc, ...domains];
        },
        /** @type {string[]} */([])
      )
      .map((domain) => `DOMAIN-SUFFIX,${domain}`)
  );

  const rulesetDescription = [
    'License: AGPL 3.0',
    'Homepage: https://ruleset.skk.moe',
    'GitHub: https://github.com/SukkaW/Surge',
    '',
    'This file contains known addresses that are avaliable in the Mainland China.'
  ];

  return Promise.all([
    ...createRuleset(
      'Sukka\'s Ruleset - Domestic Domains',
      rulesetDescription,
      new Date(),
      results,
      'ruleset',
      path.resolve(__dirname, '../List/non_ip/domestic.conf'),
      path.resolve(__dirname, '../Clash/non_ip/domestic.txt')
    ),
    compareAndWriteFile(
      [
        '#!name=[Sukka] Local DNS Mapping',
        `#!desc=Last Updated: ${new Date().toISOString()}`,
        '',
        '[Host]',
        ...Object.entries(DOMESTICS)
          .flatMap(
            ([, { domains, dns }]) => domains.flatMap((domain) => [
              `${domain} = server:${dns}`,
              `*.${domain} = server:${dns}`
            ])
          )
      ],
      path.resolve(__dirname, '../Modules/sukka_local_dns_mapping.sgmodule')
    )
  ]);
});

module.exports.buildDomesticRuleset = buildDomesticRuleset;

if (require.main === module) {
  buildDomesticRuleset();
}
