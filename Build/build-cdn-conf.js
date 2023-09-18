// @ts-check
const path = require('path');
const { createRuleset } = require('./lib/create-file');
const { fetchRemoteTextAndCreateReadlineInterface, readFileByLine } = require('./lib/fetch-remote-text-by-line');
const createTrie = require('./lib/trie');
const { task } = require('./lib/trace-runner');
const fs = require('fs');
const { processLine } = require('./lib/process-line');

const publicSuffixPath = path.resolve(__dirname, '../node_modules/.cache/public_suffix_list_dat.txt');

const getS3OSSDomains = async () => {
  const trie = createTrie();

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
    if (
      (line.startsWith('s3-') || line.startsWith('s3.'))
      && !line.includes('cn-')
    ) {
      S3OSSDomains.add(line);
    }
  });
  trie.find('.scw.cloud').forEach(line => {
    if (
      (line.startsWith('s3-') || line.startsWith('s3.'))
      && !line.includes('cn-')
    ) {
      S3OSSDomains.add(line);
    }
  });

  return S3OSSDomains;
};

const buildCdnConf = task(__filename, async () => {
  /** @type {string[]} */
  const cdnDomainsList = [];

  const getS3OSSDomainsPromise = getS3OSSDomains();

  for await (const l of readFileByLine(path.resolve(__dirname, '../Source/non_ip/cdn.conf'))) {
    if (l === '# --- [AWS S3 Replace Me] ---') {
      (await getS3OSSDomainsPromise).forEach(domain => { cdnDomainsList.push(`DOMAIN-SUFFIX,${domain}`); });
      continue;
    }
    const line = processLine(l);
    if (line) {
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

  return Promise.all(createRuleset(
    'Sukka\'s Ruleset - CDN Domains',
    description,
    new Date(),
    cdnDomainsList,
    'ruleset',
    path.resolve(__dirname, '../List/non_ip/cdn.conf'),
    path.resolve(__dirname, '../Clash/non_ip/cdn.txt')
  ));
});

module.exports.buildCdnConf = buildCdnConf;

if (require.main === module) {
  buildCdnConf();
}
