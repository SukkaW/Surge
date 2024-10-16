import picocolors from 'picocolors';
import { defaultRequestInit, requestWithLog, ResponseError } from './fetch-retry';
import { setTimeout } from 'node:timers/promises';

// eslint-disable-next-line sukka/unicorn/custom-error-definition -- typescript is better
export class CustomAbortError extends Error {
  public readonly name = 'AbortError';
  public readonly digest = 'AbortError';
}

export class Custom304NotModifiedError extends Error {
  public readonly name = 'Custom304NotModifiedError';
  public readonly digest = 'Custom304NotModifiedError';

  constructor(public readonly url: string, public readonly data: string) {
    super('304 Not Modified');
  }
}

export class CustomNoETagFallbackError extends Error {
  public readonly name = 'CustomNoETagFallbackError';
  public readonly digest = 'CustomNoETagFallbackError';

  constructor(public readonly data: string) {
    super('No ETag Fallback');
  }
}

export function sleepWithAbort(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason as Error);
      return;
    }

    signal.addEventListener('abort', stop, { once: true });

    // eslint-disable-next-line sukka/prefer-timer-id -- node:timers/promises
    setTimeout(ms, undefined, { ref: false }).then(resolve).catch(reject).finally(() => signal.removeEventListener('abort', stop));

    function stop(this: AbortSignal) { reject(this.reason as Error); }
  });
}

export async function fetchAssetsWithout304(url: string, fallbackUrls: string[] | readonly string[]) {
  const controller = new AbortController();

  const createFetchFallbackPromise = async (url: string, index: number) => {
    if (index > 0) {
    // Most assets can be downloaded within 250ms. To avoid wasting bandwidth, we will wait for 500ms before downloading from the fallback URL.
      try {
        await sleepWithAbort(500 + (index + 1) * 10, controller.signal);
      } catch {
        console.log(picocolors.gray('[fetch cancelled early]'), picocolors.gray(url));
        throw new CustomAbortError();
      }
    }
    if (controller.signal.aborted) {
      console.log(picocolors.gray('[fetch cancelled]'), picocolors.gray(url));
      throw new CustomAbortError();
    }
    const res = await requestWithLog(url, { signal: controller.signal, ...defaultRequestInit });
    const text = await res.body.text();

    if (text.length < 2) {
      throw new ResponseError(res, url, 'empty response w/o 304');
    }

    controller.abort();
    return text;
  };

  return Promise.any([
    createFetchFallbackPromise(url, -1),
    ...fallbackUrls.map(createFetchFallbackPromise)
  ]);
}
