// @ts-check
const path = require('path');
const { createRuleset } = require('./lib/create-file');
const { minifyRules } = require('./lib/minify-rules');
const { fetchRemoteTextAndCreateReadlineInterface, readFileByLine } = require('./lib/fetch-remote-text-by-line');
const Trie = require('./lib/trie');
const { runner } = require('./lib/trace-runner');
const fs = require('fs');

const publicSuffixPath = path.resolve(__dirname, '../node_modules/.cache/public_suffix-list_dat.txt');

runner(__filename, async () => {
  const trie = new Trie();

  if (fs.existsSync(publicSuffixPath)) {
    for await (const line of readFileByLine(publicSuffixPath)) {
      trie.add(line);
    }
  } else {
    console.log('public_suffix_list.dat not found, fetch directly from remote.');
    for await (const line of await fetchRemoteTextAndCreateReadlineInterface('https://publicsuffix.org/list/public_suffix_list.dat')) {
      trie.add(line);
    }
  }

  /**
   * Extract OSS domain from publicsuffix list
   * @type {Set<string>}
   */
  const S3OSSDomains = new Set();

  trie.find('.amazonaws.com').forEach(line => {
    if ((line.startsWith('s3-') || line.startsWith('s3.')) && !line.includes('cn-')) {
      S3OSSDomains.add(line);
    }
  });
  trie.find('.scw.cloud').forEach(line => {
    if ((line.startsWith('s3-') || line.startsWith('s3.')) && !line.includes('cn-')) {
      S3OSSDomains.add(line);
    }
  });

  /** @type {string[]} */
  const cdnDomainsList = [];
  for await (const line of readFileByLine(path.resolve(__dirname, '../Source/non_ip/cdn.conf'))) {
    if (line === '# --- [AWS S3 Replace Me] ---') {
      S3OSSDomains.forEach(domain => cdnDomainsList.push(`DOMAIN-SUFFIX,${domain}`));
    } else {
      cdnDomainsList.push(line);
    }
  }

  const description = [
    'License: AGPL 3.0',
    'Homepage: https://ruleset.skk.moe',
    'GitHub: https://github.com/SukkaW/Surge',
    '',
    'This file contains object storage and static assets CDN domains.'
  ];
  const ruleset = minifyRules(cdnDomainsList);

  return Promise.all(createRuleset(
    'Sukka\'s Ruleset - CDN Domains',
    description,
    new Date(),
    ruleset,
    'ruleset',
    path.resolve(__dirname, '../List/non_ip/cdn.conf'),
    path.resolve(__dirname, '../Clash/non_ip/cdn.txt')
  ));
});
