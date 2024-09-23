import path from 'node:path';
import { readFileIntoProcessedArray } from './lib/fetch-text-by-line';
import { createTrie } from './lib/trie';
import { task } from './trace';
import { SHARED_DESCRIPTION } from './lib/constants';
import { getPublicSuffixListTextPromise } from './lib/download-publicsuffixlist';
import { appendArrayInPlace } from './lib/append-array-in-place';
import { SOURCE_DIR } from './constants/dir';
import { processLine } from './lib/process-line';
import { DomainsetOutput } from './lib/create-file';

const getS3OSSDomainsPromise = (async (): Promise<string[]> => {
  const trie = createTrie(
    (await getPublicSuffixListTextPromise()).reduce<string[]>(
      (acc, cur) => {
        const tmp = processLine(cur);
        if (tmp) {
          acc.push(tmp);
        }
        return acc;
      },
      []
    ),
    true
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
    readFileIntoProcessedArray(path.join(SOURCE_DIR, 'domainset/cdn.conf')),
    readFileIntoProcessedArray(path.join(SOURCE_DIR, 'domainset/download.conf')),
    readFileIntoProcessedArray(path.join(SOURCE_DIR, 'domainset/steam.conf'))
  ]);

  appendArrayInPlace(downloadDomainSet, S3OSSDomains.map(domain => `.${domain}`));
  appendArrayInPlace(downloadDomainSet, steamDomainSet);

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
