import path from 'node:path';
import { fetchRemoteTextByLine, readFileIntoProcessedArray } from './lib/fetch-text-by-line';
import { HostnameTrie } from './lib/trie';
import { task } from './trace';
import { SHARED_DESCRIPTION } from './constants/description';
import { appendArrayInPlace } from './lib/append-array-in-place';
import { SOURCE_DIR } from './constants/dir';
import { DomainsetOutput } from './lib/create-file';
import { CRASHLYTICS_WHITELIST } from './constants/reject-data-source';

const getS3OSSDomainsPromise = (async (): Promise<string[]> => {
  const trie = new HostnameTrie();

  for await (const line of await fetchRemoteTextByLine('https://publicsuffix.org/list/public_suffix_list.dat', true)) {
    trie.add(line);
  }

  /**
   * Extract OSS domain from publicsuffix list
   */
  const S3OSSDomains = new Set<string>();

  trie.find('.amazonaws.com').forEach((line: string) => {
    if (
      (line.startsWith('s3-') || line.startsWith('s3.'))
      && !line.includes('cn-')
    ) {
      S3OSSDomains.add('.' + line);
    }
  });
  trie.find('.scw.cloud').forEach((line: string) => {
    if (
      (line.startsWith('s3-') || line.startsWith('s3.'))
      && !line.includes('cn-')
    ) {
      S3OSSDomains.add('.' + line);
    }
  });
  trie.find('sakurastorage.jp').forEach((line: string) => {
    if (
      (line.startsWith('s3-') || line.startsWith('s3.'))
    ) {
      S3OSSDomains.add('.' + line);
    }
  });

  return Array.from(S3OSSDomains);
})();

export const buildCdnDownloadConf = task(require.main === module, __filename)(async (span) => {
  const [
    S3OSSDomains,

    cdnDomainsList,
    downloadDomainSet,
    steamDomainSet
  ] = await Promise.all([
    getS3OSSDomainsPromise,
    readFileIntoProcessedArray(path.join(SOURCE_DIR, 'domainset/cdn.conf')),
    readFileIntoProcessedArray(path.join(SOURCE_DIR, 'domainset/download.conf')),
    readFileIntoProcessedArray(path.join(SOURCE_DIR, 'domainset/game-download.conf'))
  ]);

  // Move S3 domains to download domain set, since S3 files may be large
  appendArrayInPlace(downloadDomainSet, S3OSSDomains);
  appendArrayInPlace(downloadDomainSet, steamDomainSet);

  // we have whitelisted the crashlytics domain, and we also want to put it in CDN policy
  appendArrayInPlace(cdnDomainsList, CRASHLYTICS_WHITELIST);

  return Promise.all([
    new DomainsetOutput(span, 'cdn')
      .withTitle('Sukka\'s Ruleset - CDN Domains')
      .withDescription([
        ...SHARED_DESCRIPTION,
        '',
        'This file contains object storage and static assets CDN domains.'
      ])
      .addFromDomainset(cdnDomainsList)
      .write(),

    new DomainsetOutput(span, 'download')
      .withTitle('Sukka\'s Ruleset - Large Files Hosting Domains')
      .withDescription([
        ...SHARED_DESCRIPTION,
        '',
        'This file contains domains for software updating & large file hosting.'
      ])
      .addFromDomainset(downloadDomainSet)
      .write()
  ]);
});
