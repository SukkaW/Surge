import { parseFelixDnsmasqFromResp } from './lib/parse-dnsmasq';
import { task } from './trace';
import { SHARED_DESCRIPTION } from './lib/constants';
import { createMemoizedPromise } from './lib/memo-promise';
import { deserializeArray, fsFetchCache, serializeArray, getFileContentHash } from './lib/cache-filesystem';
import { DomainsetOutput } from './lib/create-file';

const url = 'https://raw.githubusercontent.com/felixonmars/dnsmasq-china-list/master/apple.china.conf';
export const getAppleCdnDomainsPromise = createMemoizedPromise(() => fsFetchCache.applyWithHttp304(
  url,
  getFileContentHash(__filename),
  parseFelixDnsmasqFromResp,
  {
    serializer: serializeArray,
    deserializer: deserializeArray
  }
));

export const buildAppleCdn = task(require.main === module, __filename)(async (span) => {
  const res: string[] = await span.traceChildPromise('get apple cdn domains', getAppleCdnDomainsPromise());

  return new DomainsetOutput(span, 'apple_cdn')
    .withTitle('Sukka\'s Ruleset - Apple CDN')
    .withDescription([
      ...SHARED_DESCRIPTION,
      '',
      'This file contains Apple\'s domains using their China mainland CDN servers.',
      '',
      'Data from:',
      ' - https://github.com/felixonmars/dnsmasq-china-list'
    ])
    .bulkAddDomainSuffix(res)
    .write();
});
