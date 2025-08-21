// @ts-check
import { createReadlineInterfaceFromResponse } from './lib/fetch-text-by-line';
import { task } from './trace';
import { SHARED_DESCRIPTION } from './constants/description';
import { once } from 'foxts/once';
import { RulesetOutput } from './lib/rules/ruleset';
import { $$fetch } from './lib/fetch-retry';
import { fastIpVersion } from 'foxts/fast-ip-version';
import DNS2 from 'dns2';
import { getTelegramBackupIPFromBase64 } from './lib/get-telegram-backup-ip';
import picocolors from 'picocolors';

export const getTelegramCIDRPromise = once(async () => {
  const resp = await $$fetch('https://core.telegram.org/resources/cidr.txt');
  const lastModified = resp.headers.get('last-modified');
  const date = lastModified ? new Date(lastModified) : new Date();

  const ipcidr: string[] = [
    // Unused secret Telegram backup CIDR, announced by AS62041
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

  const backupIPs = new Set<string>();

  // https://github.com/tdlib/td/blob/master/td/telegram/ConfigManager.cpp

  // Backup IP Source 1 (DoH)
  await Promise.all([
    DNS2.DOHClient({ dns: 'https://8.8.4.4/dns-query?dns={query}' }),
    DNS2.DOHClient({ dns: 'https://1.0.0.1/dns-query?dns={query}' })
  ].flatMap(
    (client) => [
      'apv3.stel.com', // prod
      'tapv3.stel.com' // test
    ].map(async (domain) => {
      try {
        // tapv3.stel.com was for testing server
        const resp = await client(domain, 'TXT');
        const strings = resp.answers.map(i => i.data);

        const str = strings[0]!.length > strings[1]!.length
          ? strings[0]! + strings[1]!
          : strings[1]! + strings[0]!;

        const ips = getTelegramBackupIPFromBase64(str);
        ips.forEach(i => backupIPs.add(i.ip));

        console.log('[telegram backup ip]', picocolors.green('DoH TXT'), { domain, ips });
      } catch (e) {
        console.error('[telegram backup ip]', picocolors.red('DoH TXT error'), { domain }, e);
      }
    })
  ));

  // Backup IP Source 2: Firebase Realtime Database (test server not supported)
  try {
    const text = await (await $$fetch('https://reserve-5a846.firebaseio.com/ipconfigv3.json')).json();
    if (typeof text === 'string' && text.length === 344) {
      const ips = getTelegramBackupIPFromBase64(text);
      ips.forEach(i => backupIPs.add(i.ip));

      console.log('[telegram backup ip]', picocolors.green('Firebase Realtime DB'), { ips });
    }
  } catch (e) {
    console.error('[telegram backup ip]', picocolors.red('Firebase Realtime DB error'), e);
    // ignore all errors
  }

  // Backup IP Source 3: Firebase Value Store (test server not supported)
  try {
    const json = await (await fetch('https://firestore.googleapis.com/v1/projects/reserve-5a846/databases/(default)/documents/ipconfig/v3', {
      headers: {
        Accept: '*/*',
        Origin: undefined // Without this line, Google API will return "Bad request: Origin doesn't match Host for XD3.". Probably have something to do with sqlite cache store
      }
    })).json();

    // const json = await resp.json();
    if (
      json && typeof json === 'object'
      && 'fields' in json && typeof json.fields === 'object' && json.fields
      && 'data' in json.fields && typeof json.fields.data === 'object' && json.fields.data
      && 'stringValue' in json.fields.data && typeof json.fields.data.stringValue === 'string' && json.fields.data.stringValue.length === 344
    ) {
      const ips = getTelegramBackupIPFromBase64(json.fields.data.stringValue);
      ips.forEach(i => backupIPs.add(i.ip));

      console.log('[telegram backup ip]', picocolors.green('Firebase Value Store'), { ips });
    } else {
      console.error('[telegram backup ip]', picocolors.red('Firebase Value Store data format invalid'), { json });
    }
  } catch (e) {
    console.error('[telegram backup ip]', picocolors.red('Firebase Value Store error'), e);
  }

  // Backup IP Source 4: Google App Engine
  await Promise.all([
    'https://dns-telegram.appspot.com',
    'https://dns-telegram.appspot.com/test'
  ].map(async (url) => {
    try {
      const text = await (await $$fetch(url)).text();
      if (text.length === 344) {
        const ips = getTelegramBackupIPFromBase64(text);
        ips.forEach(i => backupIPs.add(i.ip));

        console.log('[telegram backup ip]', picocolors.green('Google App Engine'), { url, ips });
      }
    } catch (e) {
      console.error('[telegram backup ip]', picocolors.red('Google App Engine error'), { url }, e);
    }
  }));

  // tcdnb.azureedge.net no longer works

  console.log('[telegram backup ip]', `Found ${backupIPs.size} backup IPs:`, backupIPs);

  ipcidr.push(...Array.from(backupIPs).map(i => i + '/32'));

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
    // .withDate(date) // With extra data source, we no longer use last-modified for file date
    .appendDataSource(
      'https://core.telegram.org/resources/cidr.txt (last updated: ' + date.toISOString() + ')'
    )
    .bulkAddCIDR4NoResolve(ipcidr)
    .bulkAddCIDR6NoResolve(ipcidr6)
    .write();
});
