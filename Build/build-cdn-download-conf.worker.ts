import path from 'node:path';
import { readFileIntoProcessedArray, fetchRemoteTextByLine } from './lib/fetch-text-by-line';
import { task } from './trace';
import { SHARED_DESCRIPTION } from './constants/description';
import { appendArrayInPlace } from 'foxts/append-array-in-place';
import { SOURCE_DIR } from './constants/dir';
import { DomainsetOutput } from './lib/rules/domainset';
import { CRASHLYTICS_WHITELIST } from './constants/reject-data-source';
import { HostnameTrie } from './lib/trie';
import { $$fetch } from './lib/fetch-retry';
import { fastUri } from 'fast-uri';

const cdnDomainSetPromise = readFileIntoProcessedArray(path.join(SOURCE_DIR, 'domainset/cdn.conf'));
const downloadDomainSetPromise = readFileIntoProcessedArray(path.join(SOURCE_DIR, 'domainset/download.conf'));
const steamDomainSetPromise = readFileIntoProcessedArray(path.join(SOURCE_DIR, 'domainset/game-download.conf'));

export const buildCdnDownloadConf = task(require.main === module, __filename)(async (span) => {
  const [
    S3OSSDomains,
    IPFSDomains,
    cdnDomainsList,
    downloadDomainSet,
    steamDomainSet
  ] = await Promise.all([
    span.traceChildAsync(
      'download public suffix list for s3',
      async () => {
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
    ),
    span.traceChildAsync(
      'load public ipfs gateway list',
      async () => {
        const data = await (await $$fetch('https://cdn.jsdelivr.net/gh/ipfs/public-gateway-checker@main/gateways.json')).json();
        if (!Array.isArray(data)) {
          console.error('Invalid IPFS gateway list format');
          return [];
        }
        return data.reduce<string[]>((acc, gateway) => {
          if (typeof gateway !== 'string') {
            return acc;
          }
          const hn = fastUri.parse(gateway).host;
          if (hn) {
            acc.push(hn.trim());
          }
          return acc;
        }, []);
      }
    ),
    cdnDomainSetPromise,
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
      .bulkAddDomainSuffix(IPFSDomains)
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
