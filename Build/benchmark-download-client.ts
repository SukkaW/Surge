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

interface DownloadResult {
  url: string,
  bytes: number,
  duration: number
}

const DEFAULT_CONCURRENCY = 18;
const BENCHMARK_HEADERS = {
  // Keep the comparison focused on client and stream overhead. request() does
  // not automatically decode content like fetch(), so identity encoding makes
  // the transferred and consumed bytes equivalent between both modes.
  'Accept-Encoding': 'identity',
  'User-Agent': 'surge-download-benchmark'
};

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

async function downloadWithFetch(url: string, agent: Dispatcher): Promise<DownloadResult> {
  const startedAt = performance.now();
  const response = await undiciFetch(url, {
    dispatcher: agent,
    headers: BENCHMARK_HEADERS
  });
  if (!response.ok || !response.body) {
    throw new Error(`HTTP ${response.status} ${url}`);
  }

  const bytes = await consumeBody(response.body);
  return { url, bytes, duration: performance.now() - startedAt };
}

async function downloadWithRequest(url: string, agent: Dispatcher): Promise<DownloadResult> {
  const startedAt = performance.now();
  const response = await undiciRequest(url, {
    dispatcher: agent,
    headers: BENCHMARK_HEADERS
  });
  if (response.statusCode < 200 || response.statusCode >= 300) {
    await response.body.dump();
    throw new Error(`HTTP ${response.statusCode} ${url}`);
  }

  const bytes = await consumeBody(response.body);
  return { url, bytes, duration: performance.now() - startedAt };
}

async function runMode(mode: BenchmarkMode, urls: string[], concurrency: number) {
  const baseAgent = new Agent({ allowH2: false });
  const agent = mode === 'request'
    ? baseAgent.compose(interceptors.redirect({ maxRedirections: 5 }))
    : baseAgent;
  const results: DownloadResult[] = new Array(urls.length);
  let nextIndex = 0;
  const startedAt = performance.now();

  const worker = async () => {
    while (nextIndex < urls.length) {
      const index = nextIndex++;
      // eslint-disable-next-line no-await-in-loop -- bounded download worker
      results[index] = await (mode === 'fetch'
        ? downloadWithFetch(urls[index], agent)
        : downloadWithRequest(urls[index], agent));
    }
  };

  try {
    await Promise.all(createFixedArray(Math.min(concurrency, urls.length)).map(worker));
  } finally {
    await agent.close();
  }

  const duration = performance.now() - startedAt;
  const bytes = results.reduce((total, result) => total + result.bytes, 0);
  const bytesPerSecond = bytes / duration * 1000;

  results.forEach((result) => {
    const resultBytesPerSecond = result.bytes / result.duration * 1000;
    console.log(
      `[download benchmark:${mode}]`,
      prettyTraffic(result.bytes),
      prettyBandwidth(resultBytesPerSecond * 8),
      `${result.duration.toFixed(1)}ms`,
      result.url
    );
  });
  console.log(
    `[download benchmark:${mode}:total]`,
    `files=${results.length}`,
    `transferred=${prettyTraffic(bytes)}`,
    `avg=${prettyBandwidth(bytesPerSecond * 8)}`,
    `wall=${duration.toFixed(1)}ms`,
    `concurrency=${concurrency}`
  );
}

function parseArguments(args: string[]) {
  let concurrency = DEFAULT_CONCURRENCY;
  let modes: BenchmarkMode[] = ['fetch', 'request'];
  const urls: string[] = [];

  for (const arg of args) {
    if (arg === '--') {
      continue;
    }
    if (arg.startsWith('--concurrency=')) {
      concurrency = Number(arg.slice('--concurrency='.length));
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

  return {
    concurrency,
    modes,
    urls: urls.length > 0 ? urls : getDefaultUrls()
  };
}

async function main() {
  const { concurrency, modes, urls } = parseArguments(process.argv.slice(2));
  console.log('[download benchmark]', `files=${urls.length}`, `concurrency=${concurrency}`, `modes=${modes.join(',')}`);

  for (const mode of modes) {
    // eslint-disable-next-line no-await-in-loop -- modes intentionally run separately for comparable totals
    await runMode(mode, urls, concurrency);
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
