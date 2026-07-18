import process from 'node:process';
import { Agent, fetch as undiciFetch, interceptors, request as undiciRequest } from 'undici';
import type { Dispatcher } from 'undici';
import { prettyBandwidth, prettyTraffic } from 'xbits';
import { createFixedArray } from 'foxts/create-fixed-array';

import {
  ADGUARD_FILTERS,
  ADGUARD_FILTERS_EXTRA,
  ADGUARD_FILTERS_WHITELIST,
  BOGUS_NXDOMAIN_DNSMASQ,
  DOMAIN_LISTS,
  DOMAIN_LISTS_EXTRA,
  HOSTS,
  HOSTS_EXTRA,
  PHISHING_DOMAIN_LISTS_EXTRA,
  PHISHING_HOSTS_EXTRA
} from './constants/reject-data-source';

type BenchmarkMode = 'fetch' | 'request';
type BenchmarkEncoding = 'identity' | 'gzip' | 'all';

interface DownloadResult {
  url: string,
  bytes: number,
  duration: number
}

interface BenchmarkResult {
  decodedBytes: number,
  wireBytes: number,
  duration: number,
  encodedResponses: number
}

interface WireMetrics {
  bytes: number,
  encodedResponses: number,
  encodings: Map<string, number>
}

const DEFAULT_CONCURRENCY = 18;
const DEFAULT_ROUNDS = 2;
const DEFAULT_ENCODING: BenchmarkEncoding = 'all';

function getBenchmarkHeaders(encoding: BenchmarkEncoding) {
  return {
    'Accept-Encoding': encoding === 'all' ? 'br, gzip, deflate, zstd' : encoding,
    'User-Agent': 'surge-download-benchmark'
  };
}

function getDefaultUrls() {
  const sourceGroups = [
    HOSTS,
    HOSTS_EXTRA,
    DOMAIN_LISTS,
    DOMAIN_LISTS_EXTRA,
    ADGUARD_FILTERS,
    ADGUARD_FILTERS_EXTRA,
    ADGUARD_FILTERS_WHITELIST,
    PHISHING_HOSTS_EXTRA,
    PHISHING_DOMAIN_LISTS_EXTRA
  ];

  return Array.from(new Set([
    ...sourceGroups.flatMap(group => group.map(source => source[0])),
    BOGUS_NXDOMAIN_DNSMASQ[0]
  ]));
}

async function consumeBody(body: AsyncIterable<Uint8Array>) {
  let bytes = 0;
  for await (const chunk of body) {
    bytes += chunk.byteLength;
  }
  return bytes;
}

async function downloadWithFetch(
  url: string,
  agent: Dispatcher,
  headers: ReturnType<typeof getBenchmarkHeaders>
): Promise<DownloadResult> {
  const startedAt = performance.now();
  const response = await undiciFetch(url, {
    dispatcher: agent,
    headers
  });
  if (!response.ok || !response.body) {
    throw new Error(`HTTP ${response.status} ${url}`);
  }

  const bytes = await consumeBody(response.body);
  return { url, bytes, duration: performance.now() - startedAt };
}

async function downloadWithRequest(
  url: string,
  agent: Dispatcher,
  headers: ReturnType<typeof getBenchmarkHeaders>
): Promise<DownloadResult> {
  const startedAt = performance.now();
  const response = await undiciRequest(url, {
    dispatcher: agent,
    headers
  });
  if (response.statusCode < 200 || response.statusCode >= 300) {
    await response.body.dump();
    throw new Error(`HTTP ${response.statusCode} ${url}`);
  }

  const bytes = await consumeBody(response.body);
  return { url, bytes, duration: performance.now() - startedAt };
}

function createWireMetricsInterceptor(metrics: WireMetrics): Dispatcher.DispatcherComposeInterceptor {
  return dispatch => (opts, handler) => dispatch(opts, {
    onRequestStart: (...args) => handler.onRequestStart?.(...args),
    onRequestUpgrade: (...args) => handler.onRequestUpgrade?.(...args),
    onResponseStart(controller, statusCode, headers, statusMessage) {
      const contentEncoding = headers['content-encoding'];
      if (contentEncoding && contentEncoding !== 'identity') {
        const encoding = Array.isArray(contentEncoding) ? contentEncoding.join(', ') : contentEncoding;
        metrics.encodedResponses++;
        metrics.encodings.set(encoding, (metrics.encodings.get(encoding) ?? 0) + 1);
      }
      return handler.onResponseStart?.(controller, statusCode, headers, statusMessage);
    },
    onResponseData(controller, chunk) {
      metrics.bytes += chunk.byteLength;
      return handler.onResponseData?.(controller, chunk);
    },
    onResponseEnd: (...args) => handler.onResponseEnd?.(...args),
    onResponseError: (...args) => handler.onResponseError?.(...args)
  });
}

function formatEncodings(encodings: Map<string, number>) {
  if (encodings.size === 0) {
    return 'identity';
  }
  return Array.from(encodings, ([encoding, count]) => `${encoding}:${count}`).join(',');
}

async function runMode(
  mode: BenchmarkMode,
  urls: string[],
  concurrency: number,
  encoding: BenchmarkEncoding,
  round: number | 'warmup',
  printFiles = true
): Promise<BenchmarkResult> {
  const baseAgent = new Agent({ allowH2: false });
  const wireMetrics: WireMetrics = {
    bytes: 0,
    encodedResponses: 0,
    encodings: new Map()
  };
  const agentInterceptors: Dispatcher.DispatcherComposeInterceptor[] = [
    // Compose this closest to the network so it observes encoded bytes before
    // the decompression interceptor transforms the body.
    createWireMetricsInterceptor(wireMetrics),
    // fetch() normally decompresses automatically while request() does not.
    // Applying the interceptor before either API sees the response gives both
    // modes the same decoded body semantics.
    ...(encoding === 'identity' ? [] : [interceptors.decompress()]),
    ...(mode === 'request' ? [interceptors.redirect({ maxRedirections: 5 })] : [])
  ];
  const agent = baseAgent.compose(agentInterceptors);
  const headers = getBenchmarkHeaders(encoding);
  const results: DownloadResult[] = new Array(urls.length);
  let nextIndex = 0;
  const startedAt = performance.now();

  const worker = async () => {
    while (nextIndex < urls.length) {
      const index = nextIndex++;
      // eslint-disable-next-line no-await-in-loop -- bounded download worker
      results[index] = await (mode === 'fetch'
        ? downloadWithFetch(urls[index], agent, headers)
        : downloadWithRequest(urls[index], agent, headers));
    }
  };

  try {
    await Promise.all(createFixedArray(Math.min(concurrency, urls.length)).map(worker));
  } finally {
    await agent.close();
  }

  const duration = performance.now() - startedAt;
  const decodedBytes = results.reduce((total, result) => total + result.bytes, 0);
  const decodedBytesPerSecond = decodedBytes / duration * 1000;
  const wireBytesPerSecond = wireMetrics.bytes / duration * 1000;

  if (printFiles) {
    results.forEach((result) => {
      const resultBytesPerSecond = result.bytes / result.duration * 1000;
      console.log(
        `[download benchmark:${mode}]`,
        `round=${round}`,
        prettyTraffic(result.bytes),
        prettyBandwidth(resultBytesPerSecond * 8),
        `${result.duration.toFixed(1)}ms`,
        result.url
      );
    });
  }
  console.log(
    `[download benchmark:${mode}:total]`,
    `round=${round}`,
    `files=${results.length}`,
    `wire=${prettyTraffic(wireMetrics.bytes)}`,
    `decoded=${prettyTraffic(decodedBytes)}`,
    `wire-avg=${prettyBandwidth(wireBytesPerSecond * 8)}`,
    `decoded-avg=${prettyBandwidth(decodedBytesPerSecond * 8)}`,
    `encoded-responses=${wireMetrics.encodedResponses}`,
    `encodings=${formatEncodings(wireMetrics.encodings)}`,
    `wall=${duration.toFixed(1)}ms`,
    `concurrency=${concurrency}`
  );

  return {
    decodedBytes,
    wireBytes: wireMetrics.bytes,
    duration,
    encodedResponses: wireMetrics.encodedResponses
  };
}

function median(values: number[]) {
  const sorted = values.toSorted((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function printModeSummary(mode: BenchmarkMode, results: BenchmarkResult[]) {
  const durations = results.map(result => result.duration);
  const medianDuration = median(durations);
  const medianDecodedBytes = median(results.map(result => result.decodedBytes));
  const medianWireBytes = median(results.map(result => result.wireBytes));
  const medianWireSpeed = median(results.map(result => result.wireBytes / result.duration * 1000));
  const medianDecodedSpeed = median(results.map(result => result.decodedBytes / result.duration * 1000));
  console.log(
    `[download benchmark:${mode}:summary]`,
    `rounds=${results.length}`,
    `wire-per-round=${prettyTraffic(medianWireBytes)}`,
    `decoded-per-round=${prettyTraffic(medianDecodedBytes)}`,
    `median-wire=${prettyBandwidth(medianWireSpeed * 8)}`,
    `median-decoded=${prettyBandwidth(medianDecodedSpeed * 8)}`,
    `median-wall=${medianDuration.toFixed(1)}ms`,
    `best-wall=${Math.min(...durations).toFixed(1)}ms`,
    `worst-wall=${Math.max(...durations).toFixed(1)}ms`
  );
}

function parseArguments(args: string[]) {
  let concurrency = DEFAULT_CONCURRENCY;
  let rounds = DEFAULT_ROUNDS;
  let warmup = true;
  let encoding: BenchmarkEncoding = DEFAULT_ENCODING;
  let modes: BenchmarkMode[] = ['fetch', 'request'];
  const urls: string[] = [];

  for (const arg of args) {
    if (arg === '--') {
      continue;
    }
    if (arg.startsWith('--concurrency=')) {
      concurrency = Number(arg.slice('--concurrency='.length));
    } else if (arg.startsWith('--rounds=')) {
      rounds = Number(arg.slice('--rounds='.length));
    } else if (arg.startsWith('--warmup=')) {
      const value = arg.slice('--warmup='.length);
      if (value !== 'true' && value !== 'false') {
        throw new TypeError(`Invalid warmup value: ${value}`);
      }
      warmup = value === 'true';
    } else if (arg.startsWith('--encoding=')) {
      const value = arg.slice('--encoding='.length);
      if (value !== 'identity' && value !== 'gzip' && value !== 'all') {
        throw new TypeError(`Invalid encoding: ${value}`);
      }
      encoding = value;
    } else if (arg.startsWith('--mode=')) {
      const mode = arg.slice('--mode='.length);
      if (mode !== 'fetch' && mode !== 'request' && mode !== 'both') {
        throw new TypeError(`Unknown benchmark mode: ${mode}`);
      }
      modes = mode === 'both' ? ['fetch', 'request'] : [mode];
    } else {
      if (!URL.canParse(arg)) {
        throw new TypeError(`Invalid benchmark URL: ${arg}`);
      }
      urls.push(arg);
    }
  }

  if (!Number.isSafeInteger(concurrency) || concurrency < 1) {
    throw new TypeError(`Invalid concurrency: ${concurrency}`);
  }
  if (!Number.isSafeInteger(rounds) || rounds < 1 || rounds > 10) {
    throw new TypeError(`Invalid rounds: ${rounds}`);
  }

  return {
    concurrency,
    rounds,
    warmup,
    encoding,
    modes,
    urls: urls.length > 0 ? urls : getDefaultUrls()
  };
}

async function main() {
  const { concurrency, rounds, warmup, encoding, modes, urls } = parseArguments(process.argv.slice(2));
  console.log(
    '[download benchmark]',
    `files=${urls.length}`,
    `concurrency=${concurrency}`,
    `rounds=${rounds}`,
    `warmup=${warmup}`,
    `encoding=${encoding}`,
    `modes=${modes.join(',')}`,
    'http-cache-interceptor=disabled'
  );

  if (warmup) {
    console.log('[download benchmark:warmup]', 'begin');
    // Use fresh Agents and discard both results. This primes shared DNS/CDN
    // state and initializes both APIs without carrying HTTP connections into
    // measured rounds.
    for (const mode of modes) {
      // eslint-disable-next-line no-await-in-loop -- warm-up is intentionally isolated per mode
      await runMode(mode, urls, concurrency, encoding, 'warmup', false);
    }
    console.log('[download benchmark:warmup]', 'complete');
  }

  const results = new Map<BenchmarkMode, BenchmarkResult[]>(modes.map(mode => [mode, []]));
  for (let round = 1; round <= rounds; round++) {
    // Reverse every other round so neither API always benefits from running
    // later in the trial.
    const roundModes = round % 2 === 0 ? modes.toReversed() : modes;
    console.log('[download benchmark:round]', `round=${round}`, `order=${roundModes.join(',')}`);
    for (const mode of roundModes) {
      // eslint-disable-next-line no-await-in-loop -- modes intentionally run separately for comparable totals
      const result = await runMode(mode, urls, concurrency, encoding, round);
      results.get(mode)?.push(result);
    }
  }

  for (const mode of modes) {
    printModeSummary(mode, results.get(mode) ?? []);
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
