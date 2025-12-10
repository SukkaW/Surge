import path from 'node:path';
import { readFileIntoProcessedArray } from './lib/fetch-text-by-line';
import { task } from './trace';
import { SHARED_DESCRIPTION } from './constants/description';
import { appendArrayInPlace } from 'foxts/append-array-in-place';
import { SOURCE_DIR } from './constants/dir';
import { DomainsetOutput } from './lib/rules/domainset';
import { CRASHLYTICS_WHITELIST } from './constants/reject-data-source';
import Worktank from 'worktank';

const cdnDomainsListPromise = readFileIntoProcessedArray(path.join(SOURCE_DIR, 'domainset/cdn.conf'));
const downloadDomainSetPromise = readFileIntoProcessedArray(path.join(SOURCE_DIR, 'domainset/download.conf'));
const steamDomainSetPromise = readFileIntoProcessedArray(path.join(SOURCE_DIR, 'domainset/game-download.conf'));

const pool = new Worktank({
  pool: {
    name: 'extract-s3-from-publicssuffix',
    size: 1 // The number of workers to keep in the pool, if more workers are needed they will be spawned up to this limit
  },
  worker: {
    autoAbort: 10000,
    autoTerminate: 20000, // The interval of milliseconds at which to check if the pool can be automatically terminated, to free up resources, workers will be spawned up again if needed
    autoInstantiate: true,
    methods: {
      // eslint-disable-next-line object-shorthand -- workertank
      getS3OSSDomains: async function (__filename: string): Promise<string[]> {
        // TODO: createRequire is a temporary workaround for https://github.com/nodejs/node/issues/51956
        const { default: module } = await import('node:module');
        const __require = module.createRequire(__filename);

        const { HostnameTrie } = __require('./lib/trie') as typeof import('./lib/trie');
        const { fetchRemoteTextByLine } = __require('./lib/fetch-text-by-line') as typeof import('./lib/fetch-text-by-line');

        const trie = new HostnameTrie();

        for await (const line of await fetchRemoteTextByLine('https://publicsuffix.org/list/public_suffix_list.dat', true)) {
          trie.add(line);
        }

        /**
         * Extract OSS domain from publicsuffix list
         */
        const S3OSSDomains: string[] = [];

        trie.find('.amazonaws.com').forEach((line: string) => {
          if (
            (line.startsWith('s3-') || line.startsWith('s3.'))
            && !line.includes('cn-')
          ) {
            S3OSSDomains.push('.' + line);
          }
        });
        trie.find('.scw.cloud').forEach((line: string) => {
          if (
            (line.startsWith('s3-') || line.startsWith('s3.'))
          // && !line.includes('cn-')
          ) {
            S3OSSDomains.push('.' + line);
          }
        });
        trie.find('sakurastorage.jp').forEach((line: string) => {
          if (
            (line.startsWith('s3-') || line.startsWith('s3.'))
          ) {
            S3OSSDomains.push('.' + line);
          }
        });

        return S3OSSDomains;
      }
    }
  }
});

export const buildCdnDownloadConf = task(require.main === module, __filename)(async (span) => {
  const [
    S3OSSDomains,
    cdnDomainsList,
    downloadDomainSet,
    steamDomainSet
  ] = await Promise.all([
    span.traceChildAsync(
      'download public suffix list for s3',
      () => pool.exec(
        'getS3OSSDomains',
        [__filename]
      ).finally(() => pool.terminate())
    ),
    cdnDomainsListPromise,
    downloadDomainSetPromise,
    steamDomainSetPromise
  ]);

  // Move S3 domains to download domain set, since S3 files may be large
  appendArrayInPlace(downloadDomainSet, S3OSSDomains);
  appendArrayInPlace(downloadDomainSet, steamDomainSet);

  // we have whitelisted the crashlytics domain, and we also want to put it in CDN policy
  appendArrayInPlace(cdnDomainsList, CRASHLYTICS_WHITELIST);

  return Promise.all([
    new DomainsetOutput(span, 'cdn')
      .withTitle('Sukka\'s Ruleset - CDN Domains')
      .appendDescription(SHARED_DESCRIPTION)
      .appendDescription(
        '',
        'This file contains object storage and static assets CDN domains.'
      )
      .addFromDomainset(cdnDomainsList)
      .write(),

    new DomainsetOutput(span, 'download')
      .withTitle('Sukka\'s Ruleset - Large Files Hosting Domains')
      .appendDescription(SHARED_DESCRIPTION)
      .appendDescription(
        '',
        'This file contains domains for software updating & large file hosting.'
      )
      .addFromDomainset(downloadDomainSet)
      .write()
  ]);
});
