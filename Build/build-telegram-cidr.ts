// @ts-check
import { defaultRequestInit, fetchWithRetry } from './lib/fetch-retry';
import { createReadlineInterfaceFromResponse } from './lib/fetch-text-by-line';
import path from 'path';
import { isIPv4, isIPv6 } from 'net';
import { processLine } from './lib/process-line';
import { createRuleset } from './lib/create-file';
import { task } from './lib/trace-runner';
import { SHARED_DESCRIPTION } from './lib/constants';

export const buildTelegramCIDR = task(import.meta.path, async () => {
  const resp = await fetchWithRetry('https://core.telegram.org/resources/cidr.txt', defaultRequestInit);
  const lastModified = resp.headers.get('last-modified');
  const date = lastModified ? new Date(lastModified) : new Date();

  const results: string[] = [];

  for await (const line of createReadlineInterfaceFromResponse(resp)) {
    const cidr = processLine(line);
    if (!cidr) continue;

    const [subnet] = cidr.split('/');
    if (isIPv4(subnet)) {
      results.push(`IP-CIDR,${cidr},no-resolve`);
    }
    if (isIPv6(subnet)) {
      results.push(`IP-CIDR6,${cidr},no-resolve`);
    }
  }

  if (results.length === 0) {
    throw new Error('Failed to fetch data!');
  }

  const description = [
    ...SHARED_DESCRIPTION,
    'Data from:',
    ' - https://core.telegram.org/resources/cidr.txt'
  ];

  return Promise.all(createRuleset(
    'Sukka\'s Ruleset - Telegram IP CIDR',
    description,
    date,
    results,
    'ruleset',
    path.resolve(import.meta.dir, '../List/ip/telegram.conf'),
    path.resolve(import.meta.dir, '../Clash/ip/telegram.txt')
  ));
});

if (import.meta.main) {
  buildTelegramCIDR();
}
