import { fetchRemoteTextByLine } from './lib/fetch-text-by-line';
import { task } from './trace';

import { once } from 'foxts/once';
import { IPListOutput } from './lib/rules/ip';
import { createFileDescription } from './constants/description';

export const getChnCidrPromise = once(async function getChnCidr() {
  return Promise.all([
    fetchRemoteTextByLine('https://chnroutes2.cdn.skk.moe/chnroutes.txt', true).then(Array.fromAsync<string>),
    fetchRemoteTextByLine('https://gaoyifan.github.io/china-operator-ip/china6.txt', true).then(Array.fromAsync<string>)
  ]);
});

export const buildChnCidr = task(require.main === module, __filename)(async (span) => {
  const [filteredCidr4, cidr6] = await span.traceChildAsync('download chnroutes2', getChnCidrPromise);

  // Can not use SHARED_DESCRIPTION here as different license
  const description = createFileDescription('CC BY-SA 2.0');

  return Promise.all([
    new IPListOutput(span, 'china_ip', false)
      .withTitle('Sukka\'s Ruleset - Mainland China IPv4 CIDR')
      .withDescription(description)
      .appendDataSource('https://chnroutes2.cdn.skk.moe/chnroutes.txt')
      .bulkAddCIDR4(filteredCidr4)
      .write(),
    new IPListOutput(span, 'china_ip_ipv6', false)
      .withTitle('Sukka\'s Ruleset - Mainland China IPv6 CIDR')
      .withDescription(description)
      .appendDataSource(
        'https://github.com/gaoyifan/china-operator-ip'
      )
      .bulkAddCIDR6(cidr6)
      .write()
  ]);
});
