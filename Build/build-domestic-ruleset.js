// @ts-check
const path = require('path');
const { DOMESTICS } = require('../Source/non_ip/domestic');
const { readFileByLine } = require('./lib/fetch-remote-text-by-line');
const { processLine } = require('./lib/process-line');
const { withBannerArray } = require('./lib/with-banner');
const { compareAndWriteFile } = require('./lib/string-array-compare');
const domainSorter = require('./lib/stable-sort-domain');

(async () => {
  const rl = readFileByLine(path.resolve(__dirname, '../Source/non_ip/domestic.conf'));
  const results = [];
  for await (const l of rl) {
    const line = processLine(l);
    if (line) {
      results.push(line);
    }
  }

  results.push(
    ...Object.entries(DOMESTICS)
      .filter(([key]) => key !== 'SYSTEM')
      .flatMap(([, { domains }]) => domains)
      .sort(domainSorter)
      .map((domain) => `DOMAIN-SUFFIX,${domain}`)
  );

  await Promise.all([
    compareAndWriteFile(
      withBannerArray(
        'Sukka\'s Surge Rules - Domestic Domains',
        [
          'License: AGPL 3.0',
          'Homepage: https://ruleset.skk.moe',
          'GitHub: https://github.com/SukkaW/Surge',
          '',
          'This file contains known addresses that are avaliable in the Mainland China.'
        ],
        new Date(),
        results
      ),
      path.resolve(__dirname, '../List/non_ip/domestic.conf')
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
          ),
        ''
      ],
      path.resolve(__dirname, '../Modules/sukka_local_dns_mapping.sgmodule')
    )
  ]);
})();
