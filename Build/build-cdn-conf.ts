import path from 'path';
import { createRuleset } from './lib/create-file';
import { fetchRemoteTextAndReadByLine, readFileByLine } from './lib/fetch-text-by-line';
import { createTrie } from './lib/trie';
import { task } from './lib/trace-runner';
import { processLine } from './lib/process-line';
import { SHARED_DESCRIPTION } from './lib/constants';

const publicSuffixPath: string = path.resolve(import.meta.dir, '../node_modules/.cache/public_suffix_list_dat.txt');

const getS3OSSDomains = async (): Promise<Set<string>> => {
  const trie = createTrie();

  const publicSuffixFile = Bun.file(publicSuffixPath);

  if (await publicSuffixFile.exists()) {
    for await (const line of readFileByLine(publicSuffixFile)) {
      trie.add(line);
    }
  } else {
    console.log('public_suffix_list.dat not found, fetch directly from remote.');
    for await (const line of await fetchRemoteTextAndReadByLine('https://publicsuffix.org/list/public_suffix_list.dat')) {
      trie.add(line);
    }
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
};

const buildCdnConf = task(import.meta.path, async () => {
  /** @type {string[]} */
  const cdnDomainsList: string[] = [];

  const getS3OSSDomainsPromise: Promise<Set<string>> = getS3OSSDomains();

  for await (const l of readFileByLine(path.resolve(import.meta.dir, '../Source/non_ip/cdn.conf'))) {
    if (l === '# --- [AWS S3 Replace Me] ---') {
      (await getS3OSSDomainsPromise).forEach((domain: string) => { cdnDomainsList.push(`DOMAIN-SUFFIX,${domain}`); });
      continue;
    }
    const line = processLine(l);
    if (line) {
      cdnDomainsList.push(line);
    }
  }

  const description: string[] = [
    ...SHARED_DESCRIPTION,
    '',
    'This file contains object storage and static assets CDN domains.'
  ];

  return Promise.all(createRuleset(
    'Sukka\'s Ruleset - CDN Domains',
    description,
    new Date(),
    cdnDomainsList,
    'ruleset',
    path.resolve(import.meta.dir, '../List/non_ip/cdn.conf'),
    path.resolve(import.meta.dir, '../Clash/non_ip/cdn.txt')
  ));
});

export { buildCdnConf };

if (import.meta.main) {
  buildCdnConf();
}
