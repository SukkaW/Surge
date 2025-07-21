import { parseFelixDnsmasqFromResp } from './lib/parse-dnsmasq';
import { task } from './trace';
import { SHARED_DESCRIPTION } from './constants/description';
import { once } from 'foxts/once';
import { DomainsetOutput } from './lib/rules/domainset';
import { $$fetch } from './lib/fetch-retry';

export const getAppleCdnDomainsPromise = once(() => $$fetch('https://raw.githubusercontent.com/felixonmars/dnsmasq-china-list/master/apple.china.conf').then(parseFelixDnsmasqFromResp));

export const buildAppleCdn = task(require.main === module, __filename)(async (span) => {
  const res: string[] = await span.traceChildPromise('get apple cdn domains', getAppleCdnDomainsPromise());

  return new DomainsetOutput(span, 'apple_cdn')
    .withTitle('Sukka\'s Ruleset - Apple CDN')
    .appendDescription(SHARED_DESCRIPTION)
    .appendDescription(
      '',
      'This file contains Apple\'s domains using their China mainland CDN servers.',
      '',
      'Data from:',
      ' - https://github.com/felixonmars/dnsmasq-china-list'
    )
    .bulkAddDomainSuffix(res)
    .write();
});
