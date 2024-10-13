import retry from 'async-retry';
import picocolors from 'picocolors';
import { setTimeout } from 'node:timers/promises';
import {
  fetch as _fetch,
  interceptors,
  EnvHttpProxyAgent,
  setGlobalDispatcher
} from 'undici';

import type { Request, Response, RequestInit } from 'undici';

import CacheableLookup from 'cacheable-lookup';
import type { LookupOptions as CacheableLookupOptions } from 'cacheable-lookup';

const cacheableLookup = new CacheableLookup();

const agent = new EnvHttpProxyAgent({
  allowH2: true,
  connect: {
    lookup(hostname, opt, cb) {
      return cacheableLookup.lookup(hostname, opt as CacheableLookupOptions, cb);
    }
  }
});

setGlobalDispatcher(agent.compose(
  interceptors.retry({
    maxRetries: 5,
    minTimeout: 10000,
    errorCodes: ['UND_ERR_HEADERS_TIMEOUT', 'ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND', 'ENETDOWN', 'ENETUNREACH', 'EHOSTDOWN', 'EHOSTUNREACH', 'EPIPE', 'ETIMEDOUT']
  }),
  interceptors.redirect({
    maxRedirections: 5
  })
));

function isClientError(err: unknown): err is NodeJS.ErrnoException {
  if (!err || typeof err !== 'object') return false;

  if ('code' in err) return err.code === 'ERR_UNESCAPED_CHARACTERS';
  if ('message' in err) return err.message === 'Request path contains unescaped characters';
  if ('name' in err) return err.name === 'AbortError';

  return false;
}

export class ResponseError extends Error {
  readonly res: Response;
  readonly code: number;
  readonly statusCode: number;
  readonly url: string;

  constructor(res: Response) {
    super(res.statusText);

    if ('captureStackTrace' in Error) {
      Error.captureStackTrace(this, ResponseError);
    }

    // eslint-disable-next-line sukka/unicorn/custom-error-definition -- deliberatly use previous name
    this.name = this.constructor.name;
    this.res = res;
    this.code = res.status;
    this.statusCode = res.status;
    this.url = res.url;
  }
}

interface FetchRetryOpt {
  minTimeout?: number,
  retries?: number,
  factor?: number,
  maxRetryAfter?: number,
  // onRetry?: (err: Error) => void,
  retryOnNon2xx?: boolean,
  retryOn404?: boolean
}

interface FetchWithRetry {
  (url: string | URL | Request, opts?: RequestInit & { retry?: FetchRetryOpt }): Promise<Response>
}

const DEFAULT_OPT: Required<FetchRetryOpt> = {
  // timeouts will be [10, 60, 360, 2160, 12960]
  // (before randomization is added)
  minTimeout: 10,
  retries: 5,
  factor: 6,
  maxRetryAfter: 20,
  retryOnNon2xx: true,
  retryOn404: false
};

function createFetchRetry(fetch: typeof _fetch): FetchWithRetry {
  const fetchRetry: FetchWithRetry = async (url, opts = {}) => {
    const retryOpts = Object.assign(
      DEFAULT_OPT,
      opts.retry
    );

    try {
      return await retry(async (bail) => {
        try {
          // this will be retried
          const res = (await fetch(url, opts));

          if ((res.status >= 500 && res.status < 600) || res.status === 429) {
            // NOTE: doesn't support http-date format
            const retryAfterHeader = res.headers.get('retry-after');
            if (retryAfterHeader) {
              const retryAfter = Number.parseInt(retryAfterHeader, 10);
              if (retryAfter) {
                if (retryAfter > retryOpts.maxRetryAfter) {
                  return res;
                }
                await setTimeout(retryAfter * 1e3, undefined, { ref: false });
              }
            }
            throw new ResponseError(res);
          } else {
            if ((!res.ok && res.status !== 304) && retryOpts.retryOnNon2xx) {
              throw new ResponseError(res);
            }
            return res;
          }
        } catch (err: unknown) {
          if (mayBailError(err)) {
            return bail(err) as never;
          };

          if (err instanceof AggregateError) {
            for (const e of err.errors) {
              if (mayBailError(e)) {
                // bail original error
                return bail(err) as never;
              };
            }
          }

          console.log(picocolors.gray('[fetch fail]'), url, { name: (err as any).name }, err);

          // Do not retry on 404
          if (err instanceof ResponseError && err.res.status === 404) {
            return bail(err) as never;
          }

          const newErr = new Error('Fetch failed');
          newErr.cause = err;
          throw newErr;
        }
      }, retryOpts);

      function mayBailError(err: unknown) {
        if (typeof err === 'object' && err !== null && 'name' in err) {
          if ((
            err.name === 'AbortError'
            || ('digest' in err && err.digest === 'AbortError')
          )) {
            console.log(picocolors.gray('[fetch abort]'), url);
            return true;
          }
          if (err.name === 'Custom304NotModifiedError') {
            return true;
          }
          if (err.name === 'CustomNoETagFallbackError') {
            return true;
          }
        }

        return !!(isClientError(err));
      };
    } catch (err) {
      if (err instanceof ResponseError) {
        return err.res;
      }
      throw err;
    }
  };

  for (const k of Object.keys(_fetch)) {
    const key = k as keyof typeof _fetch;
    fetchRetry[key] = _fetch[key];
  }

  return fetchRetry;
}

export const defaultRequestInit: RequestInit = {
  headers: {
    'User-Agent': 'curl/8.9.1 (https://github.com/SukkaW/Surge)'
  }
};

export const fetchWithRetry = createFetchRetry(_fetch as any);
