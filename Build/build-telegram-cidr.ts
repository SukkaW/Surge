// @ts-check
import { task } from './trace';
import { SHARED_DESCRIPTION } from './constants/description';
import { RulesetOutput } from './lib/rules/ruleset';
import { getTelegramCIDRPromise } from './lib/get-telegram-backup-ip';

export const buildTelegramCIDR = task(require.main === module, __filename)(async (span) => {
  const { timestamp, ipcidr, ipcidr6 } = await span.traceChildPromise('get telegram cidr', getTelegramCIDRPromise);

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
    // .withDate(date) // With extra data source, we no longer use last-modified for file date
    .appendDataSource(
      'https://core.telegram.org/resources/cidr.txt (last updated: ' + new Date(timestamp).toISOString() + ')'
    )
    .bulkAddCIDR4NoResolve(ipcidr)
    .bulkAddCIDR6NoResolve(ipcidr6)
    .write();
});
