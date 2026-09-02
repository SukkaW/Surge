// @ts-check
import { SpanCategory, task } from './trace';
import { SHARED_DESCRIPTION } from './constants/description';
import { RulesetOutput } from './lib/rules/ruleset';
import { $$fetch } from './lib/fetch-retry';
import { createReadlineInterfaceFromResponse } from './lib/fetch-text-by-line';
import { fastIpVersion } from 'foxts/fast-ip-version';
import { appendArrayInPlace } from 'foxts/append-array-in-place';
import { fetchTelegramBackupEndpoints } from './lib/fetch-telegram-backup-endpoints';

const buildTelegramCIDR = task(require.main === module, __filename)(async (span) => {
  const { timestamp, ipcidr, ipcidr6 } = await span.traceChildAsync('get telegram cidr', async (childSpan) => {
    const ipcidr: string[] = [
      // Unused secret Telegram backup CIDR, announced by AS62041
      '95.161.64.0/20'
    ];
    const ipcidr6: string[] = [];

    const date = await childSpan.traceChild('fetch from official cidr list', SpanCategory.Network).traceAsyncFn(async () => {
      const resp = await $$fetch('https://core.telegram.org/resources/cidr.txt');
      const lastModified = resp.headers.get('last-modified');

      for await (const cidr of createReadlineInterfaceFromResponse(resp, true)) {
        const v = fastIpVersion(cidr);
        if (v === 4) {
          ipcidr.push(cidr);
        } else if (v === 6) {
          ipcidr6.push(cidr);
        }
      }

      return lastModified ? new Date(lastModified) : new Date();
    });

    // https://github.com/tdlib/td/blob/master/td/telegram/ConfigManager.cpp
    const backupEndpoints = await childSpan.traceChildAsync(
      'fetch backup ip',
      innerSpan => fetchTelegramBackupEndpoints(innerSpan, { includeTestServers: true })
    );
    const backupIPs = new Set(backupEndpoints.map(endpoint => endpoint.ip));

    console.log('[telegram backup ip]', `Found ${backupIPs.size} backup IPs:`, backupIPs);

    appendArrayInPlace(ipcidr, Array.from(backupIPs, i => i + '/32'));

    return { timestamp: date.getTime(), ipcidr, ipcidr6 };
  });

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

// @ts-check
import path from 'node:path';
import process from 'node:process';

import { Api as TgApi, TelegramClient as TgClient } from 'telegram';
import { Logger as TgLogger, LogLevel as TgLogLevel } from 'telegram/extensions/Logger';
import { ConnectionTCPAbridged as TgConnectionTCPAbridged } from 'telegram/network/connection';
import { MemorySession as TgMemorySession } from 'telegram/sessions';

import { OUTPUT_INTERNAL_DIR } from './constants/dir';
import { compareAndWriteFile } from './lib/create-file';
import {
  mergeFallbackEndpoints,
  normalizeTelegramConfig,
  TELEGRAM_BOOTSTRAP_ENDPOINTS
} from './lib/mtproto-dc-config';
import type { MTProtoDCConfig } from './lib/mtproto-dc-config';

const TELEGRAM_API_ID = 2040;
const OUTPUT_PATH = path.join(OUTPUT_INTERNAL_DIR, 'mtproto-dc-config.json');

async function fetchConfig(host: string, port: number, dcId: number) {
  const session = new TgMemorySession();
  session.setDC(dcId, host, port);

  const client = new TgClient(session, TELEGRAM_API_ID, 'not-used-for-unauthenticated-rpc', {
    appVersion: '1.0',
    autoReconnect: false,
    baseLogger: new TgLogger(TgLogLevel.NONE),
    connection: TgConnectionTCPAbridged,
    connectionRetries: 1,
    deviceModel: 'Surge',
    langCode: 'en',
    reconnectRetries: 0,
    requestRetries: 1,
    securityChecks: true,
    systemLangCode: 'en',
    systemVersion: process.platform,
    timeout: 10,
    // GramJS uses this option to select port 443 even for a raw TCP connection.
    useWSS: true
  });

  try {
    const connected = await client.connect();
    if (!connected && !client.connected) {
      throw new Error('MTProto client did not connect');
    }

    return normalizeTelegramConfig(await client.invoke(new TgApi.help.GetConfig()));
  } finally {
    await client.disconnect();
  }
}

async function fetchConfigFromBootstrapEndpoints() {
  let lastError: unknown;

  for (let i = 0, len = TELEGRAM_BOOTSTRAP_ENDPOINTS.length; i < len; i++) {
    const endpoint = TELEGRAM_BOOTSTRAP_ENDPOINTS[i];
    console.log(`[telegram mtproto config] Fetching help.getConfig from ${endpoint.ip}:${endpoint.port}`);
    try {
      // Bootstrap order is significant, and one successful response ends the loop.
      // eslint-disable-next-line no-await-in-loop -- Bootstrap endpoints must be attempted in order.
      return await fetchConfig(endpoint.ip, endpoint.port, endpoint.dcId);
    } catch (error) {
      lastError = error;
      console.error(`[telegram mtproto config] ${endpoint.ip}:${endpoint.port} failed`, error);
    }
  }

  throw new AggregateError(
    lastError === undefined ? [] : [lastError],
    'All Telegram MTProto bootstrap endpoints failed'
  );
}

export const buildMTProtoDCConfig = task(require.main === module, __filename)(async (span) => {
  const config = await span.traceChildAsync(
    'fetch help.getConfig',
    fetchConfigFromBootstrapEndpoints,
    SpanCategory.Network
  );

  const backupEndpoints = await span.traceChildAsync(
    'fetch telegram backup endpoints',
    childSpan => fetchTelegramBackupEndpoints(childSpan, { includeTestServers: false })
  );

  const liveEndpoints = config.options.length;
  const mergeResult = mergeFallbackEndpoints(config, backupEndpoints);
  console.log('[telegram mtproto config]', {
    liveEndpoints,
    backupEndpoints: backupEndpoints.length,
    ...mergeResult,
    outputEndpoints: config.options.length
  });

  const output = JSON.stringify(config satisfies MTProtoDCConfig, null, 2).split('\n');
  await compareAndWriteFile(span, output, OUTPUT_PATH);
});

// Start both tasks in this worker concurrently. They retain independent trace
// results while sharing the module-scoped production backup endpoint promise.
export function buildTelegram() {
  return Promise.all([
    buildTelegramCIDR(),
    buildMTProtoDCConfig()
  ]);
}
