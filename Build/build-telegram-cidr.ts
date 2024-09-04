// @ts-check
import { defaultRequestInit, fetchWithRetry } from './lib/fetch-retry';
import { createReadlineInterfaceFromResponse } from './lib/fetch-text-by-line';
import { isProbablyIpv4, isProbablyIpv6 } from './lib/is-fast-ip';
import { processLine } from './lib/process-line';
import { createRuleset } from './lib/create-file';
import { task } from './trace';
import { SHARED_DESCRIPTION } from './lib/constants';
import { createMemoizedPromise } from './lib/memo-promise';
import { output } from './lib/misc';

export const getTelegramCIDRPromise = createMemoizedPromise(async () => {
  const resp = await fetchWithRetry('https://core.telegram.org/resources/cidr.txt', defaultRequestInit);
  const lastModified = resp.headers.get('last-modified');
  const date = lastModified ? new Date(lastModified) : new Date();

  const results: string[] = [];

  for await (const line of createReadlineInterfaceFromResponse(resp)) {
    const cidr = processLine(line);
    if (!cidr) continue;

    const [subnet] = cidr.split('/');
    if (isProbablyIpv4(subnet)) {
      results.push(`IP-CIDR,${cidr},no-resolve`);
    }
    if (isProbablyIpv6(subnet)) {
      results.push(`IP-CIDR6,${cidr},no-resolve`);
    }
  }

  return { date, results };
});

export const buildTelegramCIDR = task(require.main === module, __filename)(async (span) => {
  const { date, results } = await span.traceChildAsync('get telegram cidr', getTelegramCIDRPromise);

  if (results.length === 0) {
    throw new Error('Failed to fetch data!');
  }

  const description = [
    ...SHARED_DESCRIPTION,
    'Data from:',
    ' - https://core.telegram.org/resources/cidr.txt'
  ];

  return createRuleset(
    span,
    'Sukka\'s Ruleset - Telegram IP CIDR',
    description,
    date,
    results,
    'ruleset',
    output('telegram', 'ip')
  );
});
