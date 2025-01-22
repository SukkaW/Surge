// @ts-check
import { createReadlineInterfaceFromResponse } from './lib/fetch-text-by-line';
import { task } from './trace';
import { SHARED_DESCRIPTION } from './constants/description';
import { createMemoizedPromise } from './lib/memo-promise';
import { RulesetOutput } from './lib/create-file';
import { $$fetch } from './lib/fetch-retry';
import { fastIpVersion } from './lib/misc';

export const getTelegramCIDRPromise = createMemoizedPromise(async () => {
  const resp = await $$fetch('https://core.telegram.org/resources/cidr.txt');
  const lastModified = resp.headers.get('last-modified');
  const date = lastModified ? new Date(lastModified) : new Date();

  const ipcidr: string[] = [
    // Telegram secret backup CIDR, announced by AS62041
    // see also https://github.com/Telegram-FOSS-Team/Telegram-FOSS/blob/10da5406ed92d30c6add3b25d40b2b3b6995d873/TMessagesProj/src/main/java/org/telegram/tgnet/ConnectionsManager.java#L1157
    '95.161.64.0/20'
  ];
  const ipcidr6: string[] = [];

  for await (const cidr of createReadlineInterfaceFromResponse(resp, true)) {
    const v = fastIpVersion(cidr);
    if (v === 4) {
      ipcidr.push(cidr);
    } else if (v === 6) {
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
