import picocolors from 'picocolors';
import { prettyTraffic } from 'xbits';
import { appendArrayInPlace } from 'foxts/append-array-in-place';
import type { Dispatcher } from 'undici';

/**
 * What actually crossed the network for one request, recorded *below* undici's
 * cache interceptor.
 *
 * The progress dispatcher in fetch-retry.ts is composed on top of the agent, so
 * the cache sits between it and the socket: on a fresh cache hit it observes a
 * synthesized 200 with the full stored body and never learns that zero bytes
 * were transferred. This interceptor is composed *inside* the cache instead, so
 * it only ever runs when a request truly reaches an origin, and it sees the real
 * status:
 *
 *   - no record at all -> served from cache without touching the network
 *   - 304              -> revalidated, only headers on the wire
 *   - 200              -> full download
 */
export interface WireAttempt {
  url: string,
  statusCode: number,
  /** encoded (still compressed) body bytes actually read off the socket */
  bytes: number,
  startedAt: number,
  headersAt: number | null,
  endedAt: number | null,
  contentEncoding: string | null,
  /** the request carried If-None-Match / If-Modified-Since */
  conditional: boolean
}

export interface WireStatsSnapshot {
  attempts: WireAttempt[],
  /** every request the build issued, counted above the cache */
  totalRequests: number
}

function createEmptySnapshot(): WireStatsSnapshot {
  return { attempts: [], totalRequests: 0 };
}

let stats = createEmptySnapshot();

/** called from the interceptor composed above undici's cache */
export function countCacheableRequest() {
  stats.totalRequests++;
}

function headerValue(value: string | string[] | undefined | null): string | null {
  if (value == null) {
    return null;
  }
  return Array.isArray(value) ? value.join(', ') : value;
}

/**
 * Compose this BEFORE interceptors.cache() in the interceptor array. undici's
 * `compose` wraps each interceptor around the previous one, so the last entry is
 * the outermost — being earlier in the array is what puts this below the cache.
 */
export const wireTapInterceptor: Dispatcher.DispatcherComposeInterceptor = dispatch => (opts, handler) => {
  const attempt: WireAttempt = {
    url: (opts.origin?.toString() ?? '') + opts.path,
    statusCode: 0,
    bytes: 0,
    startedAt: performance.now(),
    headersAt: null,
    endedAt: null,
    contentEncoding: null,
    conditional: false
  };

  const requestHeaders = opts.headers;
  if (requestHeaders != null && !Array.isArray(requestHeaders)) {
    const headers = requestHeaders as Record<string, unknown>;
    attempt.conditional = ('if-none-match' in headers) || ('if-modified-since' in headers);
  }

  let recorded = false;
  const record = () => {
    if (recorded) {
      return;
    }
    recorded = true;
    attempt.endedAt = performance.now();
    stats.attempts.push(attempt);
  };

  return dispatch(opts, {
    onRequestStart: (...args) => handler.onRequestStart?.(...args),
    onRequestUpgrade: (...args) => handler.onRequestUpgrade?.(...args),
    onResponseStart(controller, statusCode, headers, statusMessage) {
      attempt.headersAt = performance.now();
      attempt.statusCode = statusCode;
      attempt.contentEncoding = headerValue(headers['content-encoding']);
      return handler.onResponseStart?.(controller, statusCode, headers, statusMessage);
    },
    onResponseData(controller, chunk) {
      attempt.bytes += chunk.byteLength;
      return handler.onResponseData?.(controller, chunk);
    },
    onResponseEnd(...args) {
      record();
      return handler.onResponseEnd?.(...args);
    },
    onResponseError(...args) {
      record();
      return handler.onResponseError?.(...args);
    }
  });
};

export function mergeWireStats(snapshot: WireStatsSnapshot | undefined) {
  if (!snapshot) {
    return;
  }
  appendArrayInPlace(stats.attempts, snapshot.attempts);
  stats.totalRequests += snapshot.totalRequests;
}

export function takeWireStats() {
  const snapshot = stats;
  stats = createEmptySnapshot();
  return snapshot;
}

/**
 * A 304 costs a full round trip to the origin but no body, so it is worth
 * separating from both a real download and a free cache hit.
 */
export function printWireStats() {
  const { attempts, totalRequests } = stats;
  if (attempts.length === 0) {
    if (totalRequests > 0) {
      console.log(
        picocolors.bold('[network wire]'),
        picocolors.green('every request served from cache, nothing hit the network')
      );
    }
    return;
  }

  let revalidated = 0;
  let downloaded = 0;
  let other = 0;
  let wireBytes = 0;
  let revalidationMs = 0;

  for (let i = 0, len = attempts.length; i < len; i++) {
    const attempt = attempts[i];
    wireBytes += attempt.bytes;
    if (attempt.statusCode === 304) {
      revalidated++;
      if (attempt.headersAt != null) {
        revalidationMs += attempt.headersAt - attempt.startedAt;
      }
    } else if (attempt.statusCode >= 200 && attempt.statusCode < 300) {
      downloaded++;
    } else {
      other++;
    }
  }

  const cacheHits = totalRequests - attempts.length;

  console.log(
    picocolors.bold('[network wire]'),
    `requests=${attempts.length}`,
    `cache-hit=${cacheHits}`,
    `revalidated-304=${revalidated}`,
    `downloaded-200=${downloaded}`,
    other > 0 ? `other=${other}` : '',
    `wire-bytes=${prettyTraffic(wireBytes)}`,
    revalidated > 0 ? `revalidation-rtt-total=${revalidationMs.toFixed(1)}ms` : ''
  );

  // The slowest wire requests are the ones worth mirroring or hedging, and a slow
  // 304 is the most actionable of all: a full round trip that returned no data.
  attempts
    .toSorted((a, b) => (b.headersAt ?? b.startedAt) - b.startedAt - ((a.headersAt ?? a.startedAt) - a.startedAt))
    .slice(0, 10)
    .forEach((attempt) => {
      const ttfb = attempt.headersAt == null ? null : attempt.headersAt - attempt.startedAt;
      console.log(
        picocolors.gray('[network wire]'),
        attempt.statusCode === 304 ? picocolors.cyan('304 revalidate') : String(attempt.statusCode),
        `ttfb=${ttfb == null ? 'n/a' : ttfb.toFixed(1) + 'ms'}`,
        `wire=${prettyTraffic(attempt.bytes)}`,
        `encoding=${attempt.contentEncoding ?? 'identity'}`,
        attempt.conditional ? picocolors.gray('conditional') : '',
        attempt.url
      );
    });
}
