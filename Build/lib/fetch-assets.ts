import picocolors from 'picocolors';
import { $$fetch, defaultRequestInit, ResponseError } from './fetch-retry';
import { waitWithAbort } from 'foxts/wait';
import { nullthrow } from 'foxts/guard';
import { TextLineStream } from 'foxts/text-line-stream';
import { ProcessLineStream } from './process-line';

// eslint-disable-next-line sukka/unicorn/custom-error-definition -- typescript is better
export class CustomAbortError extends Error {
  public readonly name = 'AbortError';
  public readonly digest = 'AbortError';
}

const reusedCustomAbortError = new CustomAbortError();

export async function fetchAssets(url: string, fallbackUrls: null | undefined | string[] | readonly string[], processLine = false) {
  const controller = new AbortController();

  const createFetchFallbackPromise = async (url: string, index: number) => {
    if (index >= 0) {
    // Most assets can be downloaded within 250ms. To avoid wasting bandwidth, we will wait for 500ms before downloading from the fallback URL.
      try {
        await waitWithAbort(50 + (index + 1) * 150, controller.signal);
      } catch {
        console.log(picocolors.gray('[fetch cancelled early]'), picocolors.gray(url));
        throw reusedCustomAbortError;
      }
    }
    if (controller.signal.aborted) {
      console.log(picocolors.gray('[fetch cancelled]'), picocolors.gray(url));
      throw reusedCustomAbortError;
    }
    const res = await $$fetch(url, { signal: controller.signal, ...defaultRequestInit });

    let stream = nullthrow(res.body, url + ' has an empty body').pipeThrough(new TextDecoderStream()).pipeThrough(new TextLineStream({ skipEmptyLines: processLine }));
    if (processLine) {
      stream = stream.pipeThrough(new ProcessLineStream());
    }
    const arr = await Array.fromAsync(stream);

    if (arr.length < 1) {
      throw new ResponseError(res, url, 'empty response w/o 304');
    }

    controller.abort();
    return arr;
  };

  if (!fallbackUrls || fallbackUrls.length === 0) {
    return createFetchFallbackPromise(url, -1);
  }
  return Promise.any([
    createFetchFallbackPromise(url, -1),
    ...fallbackUrls.map(createFetchFallbackPromise)
  ]);
}
