import dns from 'node:dns/promises';
import { Buffer } from 'node:buffer';

import picocolors from 'picocolors';
import { fastStringArrayJoin } from 'foxts/fast-string-array-join';
import { stableHash } from 'stable-hash';

import { SpanCategory } from '../trace';
import type { Span } from '../trace';
import { $$fetch } from './fetch-retry';
import { getTelegramBackupIPFromBase64 } from './get-telegram-backup-ip';
import type { TelegramBackupEndpoint } from './get-telegram-backup-ip';
import { appendArrayInPlace } from 'foxts/append-array-in-place';

interface FetchTelegramBackupEndpointsOptions {
  includeTestServers?: boolean
}

let productionEndpointsPromise: Promise<TelegramBackupEndpoint[]> | undefined;
let testEndpointsPromise: Promise<TelegramBackupEndpoint[]> | undefined;

function deduplicateEndpoints(endpoints: readonly TelegramBackupEndpoint[]) {
  const deduplicated = new Map<string, TelegramBackupEndpoint>();
  endpoints.forEach(endpoint => deduplicated.set(stableHash([
    endpoint.dcId,
    endpoint.ip,
    endpoint.port,
    endpoint.secret ? Buffer.from(endpoint.secret).toString('base64') : null
  ]), endpoint));
  return Array.from(deduplicated.values());
}

async function fetchDnsEndpoints(span: Span, domain: string, traceName: string) {
  const endpoints: TelegramBackupEndpoint[] = [];
  const resolvers = ['8.8.8.8', '1.0.0.1'].map((ip) => {
    const resolver = new dns.Resolver();
    resolver.setServers([ip]);
    return Object.assign(resolver, { server: ip });
  });

  await span.traceChild(traceName, SpanCategory.Network).traceAsyncFn(() => Promise.all(resolvers.map(async (resolver) => {
    try {
      const response = await resolver.resolveTxt(domain);
      const strings = response.map(result => fastStringArrayJoin(result, ''));
      if (strings.length !== 2) {
        throw new TypeError(`Unexpected TXT record count: ${strings.length}`);
      }

      const base64 = strings[0].length > strings[1].length
        ? strings[0] + strings[1]
        : strings[1] + strings[0];
      const decoded = getTelegramBackupIPFromBase64(base64);
      appendArrayInPlace(endpoints, decoded);

      console.log('[telegram backup ip]', picocolors.green('DNS TXT'), { domain, endpoints: decoded, server: resolver.server });
    } catch (error) {
      console.error('[telegram backup ip]', picocolors.red('DNS TXT error'), { domain }, error);
    }
  })));

  return deduplicateEndpoints(endpoints);
}

async function fetchRealtimeDatabaseEndpoints(span: Span) {
  return span.traceChild('backup source 2: Firebase Realtime DB', SpanCategory.Network).traceAsyncFn(async () => {
    try {
      const data = await (await $$fetch('https://reserve-5a846.firebaseio.com/ipconfigv3.json')).json();
      if (typeof data !== 'string' || data.length !== 344) {
        throw new TypeError('Firebase Realtime DB data format is invalid');
      }

      const endpoints = getTelegramBackupIPFromBase64(data);
      console.log('[telegram backup ip]', picocolors.green('Firebase Realtime DB'), { endpoints });
      return endpoints;
    } catch (error) {
      console.error('[telegram backup ip]', picocolors.red('Firebase Realtime DB error'), error);
      return [];
    }
  });
}

async function fetchValueStoreEndpoints(span: Span) {
  return span.traceChild('backup source 3: Firebase Value Store', SpanCategory.Network).traceAsyncFn(async () => {
    try {
      const json = await (await $$fetch('https://firestore.googleapis.com/v1/projects/reserve-5a846/databases/(default)/documents/ipconfig/v3', {
        headers: {
          Accept: '*/*',
          // Google rejects this request when the shared HTTP cache adds an Origin.
          Origin: undefined
        }
      })).json();

      if (
        !json || typeof json !== 'object'
        || !('fields' in json) || typeof json.fields !== 'object' || !json.fields
        || !('data' in json.fields) || typeof json.fields.data !== 'object' || !json.fields.data
        || !('stringValue' in json.fields.data) || typeof json.fields.data.stringValue !== 'string'
        || json.fields.data.stringValue.length !== 344
      ) {
        throw new TypeError('Firebase Value Store data format is invalid');
      }

      const endpoints = getTelegramBackupIPFromBase64(json.fields.data.stringValue);
      console.log('[telegram backup ip]', picocolors.green('Firebase Value Store'), { endpoints });
      return endpoints;
    } catch (error) {
      console.error('[telegram backup ip]', picocolors.red('Firebase Value Store error'), error);
      return [];
    }
  });
}

async function fetchAppEngineEndpoints(span: Span, url: string, traceName: string) {
  return span.traceChild(traceName, SpanCategory.Network).traceAsyncFn(async () => {
    try {
      const data = (await (await $$fetch(url)).text()).trim();
      if (data.length !== 344) {
        throw new TypeError(`Google App Engine data has an unexpected length: ${data.length}`);
      }

      const endpoints = getTelegramBackupIPFromBase64(data);
      console.log('[telegram backup ip]', picocolors.green('Google App Engine'), { url, endpoints });
      return endpoints;
    } catch (error) {
      console.error('[telegram backup ip]', picocolors.red('Google App Engine error'), { url }, error);
      return [];
    }
  });
}

async function fetchProductionEndpoints(span: Span) {
  const endpointGroups = await Promise.all([
    fetchDnsEndpoints(span, 'apv3.stel.com', 'backup source 1: DNS TXT'),
    fetchRealtimeDatabaseEndpoints(span),
    fetchValueStoreEndpoints(span),
    fetchAppEngineEndpoints(span, 'https://dns-telegram.appspot.com', 'backup source 4: Google App Engine')
  ]);
  return deduplicateEndpoints(endpointGroups.flat());
}

async function fetchTestEndpoints(span: Span) {
  const endpointGroups = await Promise.all([
    fetchDnsEndpoints(span, 'tapv3.stel.com', 'test backup source 1: DNS TXT'),
    fetchAppEngineEndpoints(span, 'https://dns-telegram.appspot.com/test', 'test backup source 4: Google App Engine')
  ]);
  return deduplicateEndpoints(endpointGroups.flat());
}

function getProductionEndpoints(span: Span) {
  if (productionEndpointsPromise) {
    return span.traceChildAsync('reuse production backup endpoints', () => productionEndpointsPromise!, SpanCategory.Wait);
  }
  productionEndpointsPromise = fetchProductionEndpoints(span);
  return productionEndpointsPromise;
}

function getTestEndpoints(span: Span) {
  if (testEndpointsPromise) {
    return span.traceChildAsync('reuse test backup endpoints', () => testEndpointsPromise!, SpanCategory.Wait);
  }
  testEndpointsPromise = fetchTestEndpoints(span);
  return testEndpointsPromise;
}

/**
 * Fetches Telegram's signed backup endpoints once per worker process. The CIDR
 * and MTProto config tasks share the production promise; only the CIDR task
 * requests the additional test-server promise.
 */
export async function fetchTelegramBackupEndpoints(
  span: Span,
  { includeTestServers = false }: FetchTelegramBackupEndpointsOptions = {}
) {
  if (!includeTestServers) return getProductionEndpoints(span);

  const [productionEndpoints, testEndpoints] = await Promise.all([
    getProductionEndpoints(span),
    getTestEndpoints(span)
  ]);
  return deduplicateEndpoints([...productionEndpoints, ...testEndpoints]);
}
