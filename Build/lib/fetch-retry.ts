import picocolors from 'picocolors';
import undici, {
  interceptors,
  Agent,
  Request as UndiciRequest
  // setGlobalDispatcher
} from 'undici';

import type {
  Dispatcher,
  Response,
  RequestInit,
  RequestInfo
} from 'undici';
import { BetterSqlite3CacheStore } from 'undici-cache-store-better-sqlite3';

export type UndiciResponseData<T = unknown> = Dispatcher.ResponseData<T>;

import { inspect } from 'node:util';
import path from 'node:path';
import fs from 'node:fs';
import { CACHE_DIR } from '../constants/dir';
import { isAbortErrorLike } from 'foxts/abort-error';
import { isErrorLikeObject } from 'foxts/extract-error-message';

if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

/**
 * Origins like filters.adtidy.org (Qrator CDN) send Last-Modified/ETag with no
 * Cache-Control/Expires, plus a large edge-dependent Age header and the ORIGINAL
 * Date header of the stored edge copy (hours in the past). undici refuses to
 * store a response whose Age exceeds its freshness lifetime (which, absent
 * explicit caching headers, is the tiny last-modified heuristic — 10% of time
 * since last modified), and separately drops any response already stale relative
 * to its Date header — so those assets never enter the cache and can never be
 * revalidated with HTTP 304. Dropping Age and Date makes undici treat the
 * response as cached-at-receipt; the content is at most Age + freshness stale
 * once, and the etag revalidation this enables is what we actually care about.
 */
const stripCdnStalenessHeaders: Dispatcher.DispatcherComposeInterceptor = dispatch => (opts, handler) => dispatch(opts, {
  onRequestStart: (...args) => handler.onRequestStart?.(...args),
  onRequestUpgrade: (...args) => handler.onRequestUpgrade?.(...args),
  onResponseStart(controller, statusCode, headers, statusMessage) {
    delete headers.age;
    delete headers.date;
    return handler.onResponseStart?.(controller, statusCode, headers, statusMessage);
  },
  onResponseData: (...args) => handler.onResponseData?.(...args),
  onResponseEnd: (...args) => handler.onResponseEnd?.(...args),
  onResponseError: (...args) => handler.onResponseError?.(...args)
});

const agent = new Agent({
  allowH2: false
}).compose(
  interceptors.dns({
    // disable IPv6
    dualStack: false,
    affinity: 4
    // TODO: proper cacheable-lookup, or even DoH
  }),
  interceptors.retry({
    maxRetries: 5,
    minTimeout: 500, // The initial retry delay in milliseconds
    maxTimeout: 10 * 1000, // The maximum retry delay in milliseconds

    // Undici still uses `statusCodes` as the first gate for HTTP response retries.
    // Our custom `retry()` callback only runs after a response status is admitted here,
    // so we must list our status codes here before we can read it in our retry callback.
    statusCodes: [404, 429, 500, 502, 503, 504],

    // TODO: this part of code is only for allow more errors to be retried by default
    // This should be removed once https://github.com/nodejs/undici/issues/3728 is implemented
    retry(err, { state, opts }, cb) {
      const errorCode = 'code' in err ? (err as NodeJS.ErrnoException).code : undefined;

      Object.defineProperty(err, '_url', {
        value: opts.method + ' ' + opts.origin?.toString() + opts.path
      });

      // Any code that is not a Undici's originated and allowed to retry
      if (
        errorCode === 'ERR_UNESCAPED_CHARACTERS'
        || errorCode === 'UND_ERR_DESTROYED'

        || err.message === 'Request path contains unescaped characters'
        || err.name === 'AbortError'
      ) {
        return cb(err);
      }

      const statusCode = 'statusCode' in err && typeof err.statusCode === 'number' ? err.statusCode : null;

      // bail out if the status code matches one of the following
      if (
        statusCode != null
        && (
          statusCode === 401 // Unauthorized, should check credentials instead of retrying
          || statusCode === 403 // Forbidden, should check permissions instead of retrying
          // || statusCode === 404 // Not Found, should check URL instead of retrying
          || statusCode === 405 // Method Not Allowed, should check method instead of retrying
        )
      ) {
        return cb(err);
      }

      const origin = opts.origin?.toString();
      if (statusCode === 404) {
        if (origin?.includes('cdn.jsdelivr.net')) {
          // continue retry anyway, jsDelivr has recently broken and return HTTP 404 for bad origin
        } else {
          return cb(err);
        }
      }

      // if (errorCode === 'UND_ERR_REQ_RETRY') {
      //   return cb(err);
      // }

      const {
        maxRetries = 5,
        minTimeout = 500,
        maxTimeout = 10 * 1000,
        timeoutFactor = 2,
        methods = ['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE', 'TRACE']
      } = opts.retryOptions || {};

      // If we reached the max number of retries
      if (state.counter > maxRetries) {
        return cb(err);
      }

      // If a set of method are provided and the current method is not in the list
      if (Array.isArray(methods) && !methods.includes(opts.method)) {
        return cb(err);
      }

      const headers = ('headers' in err && typeof err.headers === 'object') ? err.headers : undefined;

      const retryAfterHeader = (headers as Record<string, string> | null | undefined)?.['retry-after'];
      let retryAfter = -1;
      if (retryAfterHeader) {
        retryAfter = Number(retryAfterHeader);
        retryAfter = Number.isNaN(retryAfter)
          ? calculateRetryAfterHeader(retryAfterHeader)
          : retryAfter * 1e3; // Retry-After is in seconds
      }

      const retryTimeout = retryAfter > 0
        ? Math.min(retryAfter, maxTimeout)
        : Math.min(minTimeout * (timeoutFactor ** (state.counter - 1)), maxTimeout);

      console.log('[fetch retry]', 'schedule retry', { statusCode, retryTimeout, errorCode, url: opts.origin });
      // eslint-disable-next-line sukka/prefer-timer-id -- won't leak
      setTimeout(() => cb(null), retryTimeout);
    }
    // errorCodes: ['UND_ERR_HEADERS_TIMEOUT', 'ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND', 'ENETDOWN', 'ENETUNREACH', 'EHOSTDOWN', 'EHOSTUNREACH', 'EPIPE', 'ETIMEDOUT']
  }),
  interceptors.redirect({
    maxRedirections: 5
  }),
  stripCdnStalenessHeaders,
  interceptors.cache({
    store: new BetterSqlite3CacheStore({
      loose: true,
      location: path.join(CACHE_DIR, 'undici-better-sqlite3-cache-store.db'),
      maxCount: 128,
      maxEntrySize: 1024 * 1024 * 100, // 100 MiB
      revalidationRetention: 7 * 24 * 60 * 60 * 1000 // 7 days
    }),
    cacheByDefault: 10 * 60 * 1000 // 10 minutes
  })
);

export interface FetchResponseProgress {
  onResponseStart?: (contentEncoding: string | null) => void,
  onEncodedBodyChunk?: (bytes: number) => void,
  onEncodedBodyEnd?: (completed: boolean) => void
}

function createResponseProgressDispatcher(progress: FetchResponseProgress): Dispatcher {
  return agent.compose(dispatch => (opts, handler) => dispatch(opts, {
    onRequestStart: (...args) => handler.onRequestStart?.(...args),
    onRequestUpgrade: (...args) => handler.onRequestUpgrade?.(...args),
    onResponseStart(controller, statusCode, headers, statusMessage) {
      const contentEncoding = headers['content-encoding'];
      progress.onResponseStart?.(
        contentEncoding == null
          ? null
          : (Array.isArray(contentEncoding) ? contentEncoding.join(', ') : contentEncoding)
      );
      return handler.onResponseStart?.(controller, statusCode, headers, statusMessage);
    },
    onResponseData(controller, chunk) {
      progress.onEncodedBodyChunk?.(chunk.byteLength);
      return handler.onResponseData?.(controller, chunk);
    },
    onResponseEnd(...args) {
      progress.onEncodedBodyEnd?.(true);
      return handler.onResponseEnd?.(...args);
    },
    onResponseError(...args) {
      progress.onEncodedBodyEnd?.(false);
      return handler.onResponseError?.(...args);
    }
  }));
}

function calculateRetryAfterHeader(retryAfter: string) {
  const current = Date.now();
  return new Date(retryAfter).getTime() - current;
}

export class ResponseError<T extends UndiciResponseData | Response> extends Error {
  readonly code: number;
  readonly statusCode: number;

  readonly url: string;

  constructor(public readonly res: T, public readonly info: RequestInfo, ...args: any[]) {
    const statusCode = 'statusCode' in res ? res.statusCode : res.status;
    super('HTTP ' + statusCode + ' ' + args.map(_ => inspect(_)).join(' '));

    this.url = typeof info === 'string'
      ? info
      : ('url' in info
        ? info.url
        : info.href);

    // eslint-disable-next-line sukka/unicorn/custom-error-definition -- deliberatly use previous name
    this.name = this.constructor.name;
    this.res = res;
    this.code = statusCode;
    this.statusCode = statusCode;
  }
}

export const defaultRequestInit = {
  headers: {
    'User-Agent': 'node-fetch'
  }
};

export async function $$fetch(
  url: RequestInfo,
  init: RequestInit = defaultRequestInit,
  progress?: FetchResponseProgress
) {
  init.dispatcher = progress == null ? agent : createResponseProgressDispatcher(progress);

  try {
    const res = await undici.fetch(url, init);
    if (res.status >= 400) {
      throw new ResponseError(res, url);
    }

    if ((res.status < 200 || res.status > 299) && res.status !== 304) {
      throw new ResponseError(res, url);
    }

    return res;
  } catch (err: unknown) {
    if (isAbortErrorLike(err)) {
      console.log(picocolors.gray('[fetch abort]'), url);
    } else {
      console.log(picocolors.gray('[fetch fail]'), url, err);
    }

    throw err;
  }
}

export { $$fetch as '~fetch' };

/**
 * dohdec constructs its own `Request` object for its `hooks` from `globalThis.Request`
 *
 * But we are using `undici.fetch` instead of `globalThis.fetch`, hence the version
 * mismatch.
 *
 * undici, on the other hand, use `instanceof Request` internally for narrowing, resulting
 * in it treats foreign `Request` objects as `URL` and try to parse them as URLs, causing
 * `TypeError: Failed to construct 'URL': [object Request]`
 *
 * See also https://github.com/nodejs/undici/issues/2155
 *
 * We already know that dohdec will only pass one `Request` object to `fetch` because
 * of its internal `hooks`:
 *
 * https://github.com/hildjj/dohdec/blob/d2f763db62d46f505d109be12bc697224cd42f93/pkg/dohdec/lib/doh.js#L291
 */
export async function fetchForDoH(input: RequestInfo, _init?: RequestInit) {
  if (typeof input === 'object' && 'url' in input) {
    // Read body as ArrayBuffer before re-wrapping. The original body is a ReadableStream
    // from a foreign context (different undici instance / Node.js globals). Passing it
    // directly to new UndiciRequest fails undici's instanceof ReadableStream check and
    // silently drops the body. ArrayBuffer is a plain value with no cross-context issues,
    // and also allows the retry interceptor to re-send the body on retries.
    const body = input.body === null ? null : await input.arrayBuffer();

    input = new UndiciRequest(input.url, {
      method: input.method,
      mode: input.mode,
      credentials: input.credentials,
      cache: input.cache,
      redirect: input.redirect,
      integrity: input.integrity,
      keepalive: input.keepalive,
      signal: input.signal,
      headers: input.headers,
      body,

      referrer: '',
      referrerPolicy: 'no-referrer',
      dispatcher: agent
    });
  }

  // DoH servers may return a valid DNS wire format body with a non-200 status
  // (e.g. 503 with a DNS SERVFAIL). Let the DoH client parse the body and decide
  // — never throw on HTTP status here.
  return undici.fetch(input);
}

/** @deprecated -- undici.requests doesn't support gzip/br/deflate, and has difficulty w/ undidi cache */
export async function requestWithLog(url: string, opt?: Parameters<typeof undici.request>[1]) {
  opt ??= {};
  opt.dispatcher = agent;

  try {
    const res = await undici.request(url, opt);
    if (res.statusCode >= 400) {
      throw new ResponseError(res, url);
    }

    if ((res.statusCode < 200 || res.statusCode > 299) && res.statusCode !== 304) {
      throw new ResponseError(res, url);
    }

    return res;
  } catch (err: unknown) {
    if (isAbortErrorLike(err)) {
      console.log(picocolors.gray('[fetch abort]'), url);
    } else {
      console.log(picocolors.gray('[fetch fail]'), url, { name: isErrorLikeObject(err) ? err.name : undefined }, err);
    }

    throw err;
  }
}
