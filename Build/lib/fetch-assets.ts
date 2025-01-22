import picocolors from 'picocolors';
import { $$fetch, defaultRequestInit, ResponseError } from './fetch-retry';
import { waitWithAbort } from 'foxts/wait';
import { nullthrow } from 'foxts/guard';
import { TextLineStream } from './text-line-transform-stream';
import { ProcessLineStream } from './process-line';

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

export async function fetchAssets(url: string, fallbackUrls: null | undefined | string[] | readonly string[], processLine = false) {
  const controller = new AbortController();

  const createFetchFallbackPromise = async (url: string, index: number) => {
    if (index >= 0) {
    // Most assets can be downloaded within 250ms. To avoid wasting bandwidth, we will wait for 500ms before downloading from the fallback URL.
      try {
        await waitWithAbort(50 + (index + 1) * 100, controller.signal);
      } catch {
        console.log(picocolors.gray('[fetch cancelled early]'), picocolors.gray(url));
        throw new CustomAbortError();
      }
    }
    if (controller.signal.aborted) {
      console.log(picocolors.gray('[fetch cancelled]'), picocolors.gray(url));
      throw new CustomAbortError();
    }
    const res = await $$fetch(url, { signal: controller.signal, ...defaultRequestInit });

    let stream = nullthrow(res.body).pipeThrough(new TextDecoderStream()).pipeThrough(new TextLineStream());
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
