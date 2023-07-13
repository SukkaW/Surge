// @ts-check
const fs = require('fs');
const path = require('path');
const { compareAndWriteFile } = require('./lib/string-array-compare');
const { withBannerArray } = require('./lib/with-banner');
const { minifyRules } = require('./lib/minify-rules');
const { domainDeduper } = require('./lib/domain-deduper');
const { shouldIgnoreLine } = require('./lib/should-ignore-line');
const { fetchRemoteTextAndCreateReadlineInterface } = require('./lib/fetch-remote-text-by-line');

const readline = require('readline');

(async () => {
  console.time('Total Time - build-cdn-conf');

  /**
   * Extract OSS domain from publicsuffix list
   * @type {Set<string>}
   */
  const S3OSSDomains = new Set();

  for await (const line of await fetchRemoteTextAndCreateReadlineInterface('https://publicsuffix.org/list/public_suffix_list.dat')) {
    if (
      line
      && (
        line.startsWith('s3-')
        || line.startsWith('s3.')
      )
      && (
        line.endsWith('.amazonaws.com')
        || line.endsWith('.scw.cloud')
      )
      && !line.includes('cn-')
    ) {
      S3OSSDomains.add(line);
    }
  }

  const content = (await fs.promises.readFile(path.resolve(__dirname, '../Source/non_ip/cdn.conf'), 'utf-8'))
    .replace(
      '# --- [AWS S3 Replace Me] ---',
      Array.from(S3OSSDomains).map(domain => `DOMAIN-SUFFIX,${domain}`).join('\n')
    );

  await compareAndWriteFile(
    withBannerArray(
      'Sukka\'s Surge Rules - CDN Domains',
      [
        'License: AGPL 3.0',
        'Homepage: https://ruleset.skk.moe',
        'GitHub: https://github.com/SukkaW/Surge',
        '',
        'This file contains object storage and static assets CDN domains.'
      ],
      new Date(),
      minifyRules(content.split('\n'))
    ),
    path.resolve(__dirname, '../List/non_ip/cdn.conf')
  );

  /**
   * Dedupe cdn.conf
   */
  /** @type {Set<string>} */
  const cdnDomains = new Set();

  for await (const line of readline.createInterface({
    input: fs.createReadStream(path.resolve(__dirname, '../Source/domainset/cdn.conf'), 'utf-8'),
    crlfDelay: Infinity
  })) {
    const l = shouldIgnoreLine(line);
    if (l) {
      cdnDomains.add(l);
    }
  }

  await compareAndWriteFile(
    withBannerArray(
      'Sukka\'s Surge Rules - CDN Domains',
      [
        'License: AGPL 3.0',
        'Homepage: https://ruleset.skk.moe',
        'GitHub: https://github.com/SukkaW/Surge',
        '',
        'This file contains object storage and static assets CDN domains.'
      ],
      new Date(),
      minifyRules(domainDeduper(Array.from(cdnDomains)))
    ),
    path.resolve(__dirname, '../List/domainset/cdn.conf')
  );

  console.timeEnd('Total Time - build-cdn-conf');
})();
