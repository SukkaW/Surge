import path from 'path';
import { createRuleset } from './lib/create-file';
import { readFileIntoProcessedArray } from './lib/fetch-text-by-line';
import { createTrie } from './lib/trie';
import { task } from './trace';
import { SHARED_DESCRIPTION } from './lib/constants';
import { getPublicSuffixListTextPromise } from './lib/download-publicsuffixlist';
import { domainDeduper } from './lib/domain-deduper';
import { appendArrayInPlace } from './lib/append-array-in-place';

const getS3OSSDomainsPromise = (async (): Promise<Set<string>> => {
  const trie = createTrie((await getPublicSuffixListTextPromise()).split('\n'));

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

  return S3OSSDomains;
})();

export const buildCdnDownloadConf = task(import.meta.path, async (span) => {
  const [
    S3OSSDomains,

    cdnDomainsList,
    downloadDomainSet,
    steamDomainSet
  ] = await Promise.all([
    getS3OSSDomainsPromise,
    readFileIntoProcessedArray(path.resolve(import.meta.dir, '../Source/domainset/cdn.conf')),
    readFileIntoProcessedArray(path.resolve(import.meta.dir, '../Source/domainset/download.conf')),
    readFileIntoProcessedArray(path.resolve(import.meta.dir, '../Source/domainset/steam.conf'))
  ]);

  appendArrayInPlace(cdnDomainsList, Array.from(S3OSSDomains).map((domain) => `.${domain}`));

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
      domainDeduper(cdnDomainsList),
      'domainset',
      path.resolve(import.meta.dir, '../List/domainset/cdn.conf'),
      path.resolve(import.meta.dir, '../Clash/domainset/cdn.txt')
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
      domainDeduper([
        ...downloadDomainSet,
        ...steamDomainSet
      ]),
      'domainset',
      path.resolve(import.meta.dir, '../List/domainset/download.conf'),
      path.resolve(import.meta.dir, '../Clash/domainset/download.txt')
    )
  ]);
});

if (import.meta.main) {
  buildCdnDownloadConf();
}
