import retry from 'async-retry';
import picocolors from 'picocolors';

// retry settings
const MIN_TIMEOUT = 10;
const MAX_RETRIES = 5;
const MAX_RETRY_AFTER = 20;
const FACTOR = 6;

function isClientError(err: any): err is NodeJS.ErrnoException {
  if (!err) return false;
  return (
    err.code === 'ERR_UNESCAPED_CHARACTERS'
    || err.message === 'Request path contains unescaped characters'
  );
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
  retry?: number,
  onRetry?: (err: Error) => void,
  retryOnAborted?: boolean
}

interface FetchWithRetry {
  (url: string | URL | Request, opts?: RequestInit & { retry?: FetchRetryOpt }): Promise<Response>
}

function createFetchRetry($fetch: typeof fetch): FetchWithRetry {
  const fetchRetry: FetchWithRetry = async (url, opts = {}) => {
    const retryOpts = Object.assign(
      {
        // timeouts will be [10, 60, 360, 2160, 12960]
        // (before randomization is added)
        minTimeout: MIN_TIMEOUT,
        retries: MAX_RETRIES,
        factor: FACTOR,
        maxRetryAfter: MAX_RETRY_AFTER,
        retryOnAborted: false,
        retryOnNon2xx: true
      },
      opts.retry
    );

    try {
      return await retry<Response>(async (bail) => {
        try {
          // this will be retried
          const res = (await $fetch(url, opts)) as Response;

          if ((res.status >= 500 && res.status < 600) || res.status === 429) {
            // NOTE: doesn't support http-date format
            const retryAfterHeader = res.headers.get('retry-after');
            if (retryAfterHeader) {
              const retryAfter = Number.parseInt(retryAfterHeader, 10);
              if (retryAfter) {
                if (retryAfter > retryOpts.maxRetryAfter) {
                  return res;
                }
                await Bun.sleep(retryAfter * 1e3);
              }
            }
            throw new ResponseError(res);
          } else {
            if (!res.ok && retryOpts.retryOnNon2xx) {
              throw new ResponseError(res);
            }
            return res;
          }
        } catch (err: unknown) {
          if (err instanceof Error) {
            if (
              err.name === 'AbortError'
              || ('digest' in err && err.digest === 'AbortError')
            ) {
              if (!retryOpts.retryOnAborted) {
                console.log(picocolors.gray('[fetch abort]'), url);
                return bail(err) as never;
              }
            }
          }
          if (isClientError(err)) {
            return bail(err) as never;
          }

          console.log(picocolors.gray('[fetch fail]'), url);
          throw err;
        }
      }, retryOpts);
    } catch (err) {
      if (err instanceof ResponseError) {
        return err.res;
      }
      throw err;
    }
  };

  for (const k of Object.keys($fetch)) {
    const key = k as keyof typeof $fetch;
    fetchRetry[key] = $fetch[key];
  }

  return fetchRetry;
}

export const defaultRequestInit: RequestInit = {
  headers: {
    'User-Agent': 'curl/8.1.2 (https://github.com/SukkaW/Surge)'
  }
};

export const fetchWithRetry = createFetchRetry(fetch);
