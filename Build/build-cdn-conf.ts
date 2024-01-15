import path from 'path';
import { createRuleset } from './lib/create-file';
import { readFileIntoProcessedArray } from './lib/fetch-text-by-line';
import { createTrie } from './lib/trie';
import { task } from './trace';
import { SHARED_DESCRIPTION } from './lib/constants';
import { getPublicSuffixListTextPromise } from './download-publicsuffixlist';

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

const buildCdnConf = task(import.meta.path, async (span) => {
  /** @type {string[]} */
  const cdnDomainsList: string[] = await readFileIntoProcessedArray(path.resolve(import.meta.dir, '../Source/non_ip/cdn.conf'));
  (await getS3OSSDomainsPromise).forEach((domain: string) => { cdnDomainsList.push(`DOMAIN-SUFFIX,${domain}`); });

  const description: string[] = [
    ...SHARED_DESCRIPTION,
    '',
    'This file contains object storage and static assets CDN domains.'
  ];

  return createRuleset(
    span,
    'Sukka\'s Ruleset - CDN Domains',
    description,
    new Date(),
    cdnDomainsList,
    'ruleset',
    path.resolve(import.meta.dir, '../List/non_ip/cdn.conf'),
    path.resolve(import.meta.dir, '../Clash/non_ip/cdn.txt')
  );
});

export { buildCdnConf };

if (import.meta.main) {
  buildCdnConf();
}
