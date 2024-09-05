import picocolors from 'picocolors';
import { defaultRequestInit, fetchWithRetry } from './fetch-retry';
import { setTimeout } from 'node:timers/promises';

// eslint-disable-next-line sukka/unicorn/custom-error-definition -- typescript is better
class CustomAbortError extends Error {
  public readonly name = 'AbortError';
  public readonly digest = 'AbortError';
}

const sleepWithAbort = (ms: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  if (signal.aborted) {
    reject(signal.reason as Error);
    return;
  }

  signal.addEventListener('abort', stop, { once: true });

  // eslint-disable-next-line sukka/prefer-timer-id -- node:timers/promises
  setTimeout(ms, undefined, { ref: false }).then(resolve).catch(reject).finally(() => signal.removeEventListener('abort', stop));

  function stop(this: AbortSignal) { reject(this.reason as Error); }
});

export async function fetchAssets(url: string, fallbackUrls: string[] | readonly string[]) {
  const controller = new AbortController();

  const fetchMainPromise = fetchWithRetry(url, { signal: controller.signal, ...defaultRequestInit })
    .then(r => r.text())
    .then(text => {
      controller.abort();
      return text;
    });
  const createFetchFallbackPromise = async (url: string, index: number) => {
    // Most assets can be downloaded within 250ms. To avoid wasting bandwidth, we will wait for 500ms before downloading from the fallback URL.
    try {
      await sleepWithAbort(500 + (index + 1) * 20, controller.signal);
    } catch {
      console.log(picocolors.gray('[fetch cancelled early]'), picocolors.gray(url));
      throw new CustomAbortError();
    }
    if (controller.signal.aborted) {
      console.log(picocolors.gray('[fetch cancelled]'), picocolors.gray(url));
      throw new CustomAbortError();
    }
    const res = await fetchWithRetry(url, { signal: controller.signal, ...defaultRequestInit });
    const text = await res.text();
    controller.abort();
    return text;
  };

  return Promise.any([
    fetchMainPromise,
    ...fallbackUrls.map(createFetchFallbackPromise)
  ]).catch(e => {
    console.log(`Download Rule for [${url}] failed`);
    throw e;
  });
}
