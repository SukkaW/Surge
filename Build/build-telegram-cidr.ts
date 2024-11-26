// @ts-check
import { createReadlineInterfaceFromResponse } from './lib/fetch-text-by-line';
import { isProbablyIpv4, isProbablyIpv6 } from './lib/is-fast-ip';
import { task } from './trace';
import { SHARED_DESCRIPTION } from './constants/description';
import { createMemoizedPromise } from './lib/memo-promise';
import { RulesetOutput } from './lib/create-file';
import { $fetch } from './lib/make-fetch-happen';

export const getTelegramCIDRPromise = createMemoizedPromise(async () => {
  const resp = await $fetch('https://core.telegram.org/resources/cidr.txt');
  const lastModified = resp.headers.get('last-modified');
  const date = lastModified ? new Date(lastModified) : new Date();

  const ipcidr: string[] = [];
  const ipcidr6: string[] = [];

  for await (const cidr of createReadlineInterfaceFromResponse(resp, true)) {
    const [subnet] = cidr.split('/');
    if (isProbablyIpv4(subnet)) {
      ipcidr.push(cidr);
    }
    if (isProbablyIpv6(subnet)) {
      ipcidr6.push(cidr);
    }
  }

  return { date, ipcidr, ipcidr6 };
});

export const buildTelegramCIDR = task(require.main === module, __filename)(async (span) => {
  const { date, ipcidr, ipcidr6 } = await span.traceChildAsync('get telegram cidr', getTelegramCIDRPromise);

  if (ipcidr.length + ipcidr6.length === 0) {
    throw new Error('Failed to fetch data!');
  }

  const description = [
    ...SHARED_DESCRIPTION,
    'Data from:',
    ' - https://core.telegram.org/resources/cidr.txt'
  ];

  return new RulesetOutput(span, 'telegram', 'ip')
    .withTitle('Sukka\'s Ruleset - Telegram IP CIDR')
    .withDescription(description)
    .withDate(date)
    .bulkAddCIDR4NoResolve(ipcidr)
    .bulkAddCIDR6NoResolve(ipcidr6)
    .write();
});
