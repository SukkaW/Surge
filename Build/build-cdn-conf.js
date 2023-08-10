// @ts-check
const path = require('path');
const { compareAndWriteFile } = require('./lib/string-array-compare');
const { withBannerArray } = require('./lib/with-banner');
const { minifyRules } = require('./lib/minify-rules');
const { domainDeduper } = require('./lib/domain-deduper');
const { processLine } = require('./lib/process-line');
const { fetchRemoteTextAndCreateReadlineInterface, readFileByLine } = require('./lib/fetch-remote-text-by-line');
const Trie = require('./lib/trie');

(async () => {
  console.time('Total Time - build-cdn-conf');

  const trie = new Trie();
  for await (const line of await fetchRemoteTextAndCreateReadlineInterface('https://publicsuffix.org/list/public_suffix_list.dat')) {
    trie.add(line);
  }

  /**
   * Extract OSS domain from publicsuffix list
   * @type {Set<string>}
   */
  const S3OSSDomains = new Set();

  trie.find('.amazonaws.com')
    .filter(line => (line.startsWith('s3-') || line.startsWith('s3.')) && !line.includes('cn-'))
    .forEach(line => S3OSSDomains.add(line));

  trie.find('.scw.cloud')
    .filter(line => (line.startsWith('s3-') || line.startsWith('s3.')) && !line.includes('cn-'))
    .forEach(line => S3OSSDomains.add(line));

  /** @type {string[]} */
  const cdnDomainsList = [];
  for await (const line of readFileByLine(path.resolve(__dirname, '../Source/non_ip/cdn.conf'))) {
    if (line === '# --- [AWS S3 Replace Me] ---') {
      S3OSSDomains.forEach(domain => cdnDomainsList.push(`DOMAIN-SUFFIX,${domain}`));
    } else {
      cdnDomainsList.push(line);
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
      minifyRules(cdnDomainsList)
    ),
    path.resolve(__dirname, '../List/non_ip/cdn.conf')
  );

  /**
   * Dedupe cdn.conf
   */
  /** @type {Set<string>} */
  const cdnDomains = new Set();

  for await (const line of readFileByLine(
    path.resolve(__dirname, '../Source/domainset/cdn.conf')
  )) {
    const l = processLine(line);
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
