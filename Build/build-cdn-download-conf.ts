import path from 'path';
import { createRuleset } from './lib/create-file';
import { readFileIntoProcessedArray } from './lib/fetch-text-by-line';
import { createTrie } from './lib/trie';
import { task } from './trace';
import { SHARED_DESCRIPTION } from './lib/constants';
import { getPublicSuffixListTextPromise } from './lib/download-publicsuffixlist';
import { domainDeduper } from './lib/domain-deduper';
import { appendArrayInPlace } from './lib/append-array-in-place';
import { sortDomains } from './lib/stable-sort-domain';

const getS3OSSDomainsPromise = (async (): Promise<string[]> => {
  const trie = createTrie(
    await getPublicSuffixListTextPromise(),
    true,
    false
  );

  /**
   * Extract OSS domain from publicsuffix list
   */
  const S3OSSDomains = new Set<string>();

  trie.find('.amazonaws.com').forEach((line: string) => {
    if (
      (line.startsWith('s3-') || line.startsWith('s3.'))
      && !line.includes('cn-')
    ) {
      S3OSSDomains.add(line);
    }
  });
  trie.find('.scw.cloud').forEach((line: string) => {
    if (
      (line.startsWith('s3-') || line.startsWith('s3.'))
      && !line.includes('cn-')
    ) {
      S3OSSDomains.add(line);
    }
  });
  trie.find('sakurastorage.jp').forEach((line: string) => {
    if (
      (line.startsWith('s3-') || line.startsWith('s3.'))
    ) {
      S3OSSDomains.add(line);
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
    readFileIntoProcessedArray(path.resolve(__dirname, '../Source/domainset/cdn.conf')),
    readFileIntoProcessedArray(path.resolve(__dirname, '../Source/domainset/download.conf')),
    readFileIntoProcessedArray(path.resolve(__dirname, '../Source/domainset/steam.conf'))
  ]);

  appendArrayInPlace(downloadDomainSet, S3OSSDomains.map(domain => `.${domain}`));
  appendArrayInPlace(downloadDomainSet, steamDomainSet);

  return Promise.all([
    createRuleset(
      span,
      'Sukka\'s Ruleset - CDN Domains',
      [
        ...SHARED_DESCRIPTION,
        '',
        'This file contains object storage and static assets CDN domains.'
      ],
      new Date(),
      sortDomains(domainDeduper(cdnDomainsList)),
      'domainset',
      path.resolve(__dirname, '../List/domainset/cdn.conf'),
      path.resolve(__dirname, '../Clash/domainset/cdn.txt')
    ),
    createRuleset(
      span,
      'Sukka\'s Ruleset - Large Files Hosting Domains',
      [
        ...SHARED_DESCRIPTION,
        '',
        'This file contains domains for software updating & large file hosting.'
      ],
      new Date(),
      sortDomains(domainDeduper(downloadDomainSet)),
      'domainset',
      path.resolve(__dirname, '../List/domainset/download.conf'),
      path.resolve(__dirname, '../Clash/domainset/download.txt')
    )
  ]);
});
