// @ts-check
import { SpanCategory, task } from './trace';
import { SHARED_DESCRIPTION } from './constants/description';
import { RulesetOutput } from './lib/rules/ruleset';
import { $$fetch } from './lib/fetch-retry';
import { createReadlineInterfaceFromResponse } from './lib/fetch-text-by-line';
import { fastIpVersion } from 'foxts/fast-ip-version';
import { appendArrayInPlace } from 'foxts/append-array-in-place';
import { fetchTelegramBackupEndpoints } from './lib/fetch-telegram-backup-endpoints';

const buildTelegramCIDR = task(require.main === module, 'build-telegram-cidr')(async (span) => {
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
import { AuthKey as TgAuthKey } from 'telegram/crypto/AuthKey';
import { Logger as TgLogger, LogLevel as TgLogLevel } from 'telegram/extensions/Logger';
import { ConnectionTCPAbridged as TgConnectionTCPAbridged } from 'telegram/network/connection';
import { MemorySession as TgMemorySession } from 'telegram/sessions';
import type { Buffer } from 'node:buffer';
import type { Span } from './trace';
import { mtprotoAuthKeyStore } from './lib/mtproto-auth-key-store';

import { OUTPUT_INTERNAL_DIR } from './constants/dir';
import { compareAndWriteFile } from './lib/create-file';
import {
  mergeFallbackEndpoints,
  normalizeTelegramConfig,
  TELEGRAM_BOOTSTRAP_ENDPOINTS
} from './lib/mtproto-dc-config';
import type { MTProtoDCConfig, MTProtoEndpoint } from './lib/mtproto-dc-config';

const TELEGRAM_API_ID = 2040;
const OUTPUT_PATH = path.join(OUTPUT_INTERNAL_DIR, 'mtproto-dc-config.json');

/**
 * How long a connect + help.getConfig with a persisted auth key may take before
 * we give the key up. Normally 0.5-1.5s. It has to be a hard deadline: when a DC
 * has forgotten the key it answers with transport error -404, and GramJS merely
 * logs "Broken authorization key" and fires a connection-state event -- the
 * pending request promise never settles.
 */
const PERSISTED_AUTH_KEY_TIMEOUT = 5000;

class PersistedAuthKeyTimeoutError extends Error {
  constructor(dcId: number, options?: ErrorOptions) {
    super(`No help.getConfig response within ${PERSISTED_AUTH_KEY_TIMEOUT}ms using the persisted auth key for dc${dcId}`, options);
    this.name = 'PersistedAuthKeyTimeoutError';
  }
}

/**
 * One connect + help.getConfig against a DC. With a persisted auth key the
 * connect skips the DH handshake (three round trips); without one, GramJS
 * negotiates a key and we persist it for the next build.
 */
async function fetchConfig(host: string, port: number, dcId: number, persistedAuthKey: Buffer | null) {
  const session = new TgMemorySession();
  session.setDC(dcId, host, port);
  if (persistedAuthKey) {
    const authKey = new TgAuthKey();
    await authKey.setKey(persistedAuthKey);
    session.setAuthKey(authKey, dcId);
  }

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

  const work = async () => {
    const connected = await client.connect();
    if (!connected && !client.connected) {
      throw new Error('MTProto client did not connect');
    }

    const config = normalizeTelegramConfig(await client.invoke(new TgApi.help.GetConfig()));

    if (!persistedAuthKey) {
      const negotiated = client.session.authKey?.getKey();
      if (negotiated) {
        await mtprotoAuthKeyStore.save(dcId, negotiated);
      }
    }

    return config;
  };

  let timer: NodeJS.Timeout | null = null;
  try {
    if (!persistedAuthKey) {
      return await work();
    }
    return await Promise.race([
      work(),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(reject, PERSISTED_AUTH_KEY_TIMEOUT, new PersistedAuthKeyTimeoutError(dcId));
      })
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
    // destroy, not disconnect: a sender stuck on a rejected key must not keep the
    // process alive after we have moved on to a fresh handshake
    await client.destroy();
  }
}

async function fetchConfigFromEndpoint(span: Span, endpoint: MTProtoEndpoint) {
  const label = `${endpoint.ip}:${endpoint.port}`;

  const persistedAuthKey = await mtprotoAuthKeyStore.load(endpoint.dcId);
  if (persistedAuthKey) {
    try {
      return await span.traceChildAsync(
        `help.getConfig via ${label} (persisted auth key)`,
        () => fetchConfig(endpoint.ip, endpoint.port, endpoint.dcId, persistedAuthKey),
        SpanCategory.Network
      );
    } catch (error) {
      // Most likely the DC no longer knows this key, which surfaces as the
      // timeout above (see PERSISTED_AUTH_KEY_TIMEOUT). Whatever it was, a key
      // that fails once is not worth a second try: fall through to a fresh handshake.
      console.warn(`[telegram mtproto config] ${label} failed with the persisted auth key for dc${endpoint.dcId}, renegotiating`, error);
      await mtprotoAuthKeyStore.drop(endpoint.dcId);
    }
  }

  return span.traceChildAsync(
    `help.getConfig via ${label} (fresh handshake)`,
    () => fetchConfig(endpoint.ip, endpoint.port, endpoint.dcId, null),
    SpanCategory.Network
  );
}

async function fetchConfigFromBootstrapEndpoints(span: Span) {
  let lastError: unknown;

  for (let i = 0, len = TELEGRAM_BOOTSTRAP_ENDPOINTS.length; i < len; i++) {
    const endpoint = TELEGRAM_BOOTSTRAP_ENDPOINTS[i];
    console.log(`[telegram mtproto config] Fetching help.getConfig from ${endpoint.ip}:${endpoint.port}`);
    try {
      // Bootstrap order is significant, and one successful response ends the loop.
      // eslint-disable-next-line no-await-in-loop -- Bootstrap endpoints must be attempted in order.
      return await fetchConfigFromEndpoint(span, endpoint);
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

export const buildMTProtoDCConfig = task(require.main === module, 'build-mtproto-dc-config')(async (span) => {
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
