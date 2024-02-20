import path from 'path';
import { createRuleset } from './lib/create-file';
import { readFileIntoProcessedArray } from './lib/fetch-text-by-line';
import { createTrie } from './lib/trie';
import { task } from './trace';
import { SHARED_DESCRIPTION } from './lib/constants';
import { getPublicSuffixListTextPromise } from './lib/download-publicsuffixlist';

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
    cdnDomainsList,
    S3OSSDomains,
    downloadDomainSet,
    steamDomainSet
  ] = await Promise.all([
    readFileIntoProcessedArray(path.resolve(import.meta.dir, '../Source/non_ip/cdn.conf')),
    getS3OSSDomainsPromise,
    readFileIntoProcessedArray(path.resolve(import.meta.dir, '../Source/domainset/download.conf')),
    readFileIntoProcessedArray(path.resolve(import.meta.dir, '../Source/domainset/steam.conf'))
  ]);

  cdnDomainsList.push(...Array.from(S3OSSDomains).map((domain) => `DOMAIN-SUFFIX,${domain}`));

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
      cdnDomainsList,
      'ruleset',
      path.resolve(import.meta.dir, '../List/non_ip/cdn.conf'),
      path.resolve(import.meta.dir, '../Clash/non_ip/cdn.txt')
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
      [
        ...downloadDomainSet,
        ...steamDomainSet
      ],
      'domainset',
      path.resolve(import.meta.dir, '../List/domainset/download.conf'),
      path.resolve(import.meta.dir, '../Clash/domainset/download.txt')
    )
  ]);
});

if (import.meta.main) {
  buildCdnDownloadConf();
}
