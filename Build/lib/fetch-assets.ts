import picocolors from 'picocolors';
import { $$fetch, defaultRequestInit, ResponseError } from './fetch-retry';
import { waitWithAbort } from 'foxts/wait';
import { nullthrow } from 'foxts/guard';
import { TextLineStream } from 'foxts/text-line-stream';
import { ProcessLineStream } from './process-line';
import { AdGuardFilterIgnoreUnsupportedLinesStream } from './parse-filter/filters';
import { appendArrayInPlace } from 'foxts/append-array-in-place';

import { newQueue } from '@henrygd/queue';
import { AbortError } from 'foxts/abort-error';

const reusedCustomAbortError = new AbortError();

const queue = newQueue(16);

export async function fetchAssets(
  url: string, fallbackUrls: null | undefined | string[] | readonly string[],
  processLine = false, allowEmpty = false, filterAdGuardUnsupportedLines = false
) {
  const controller = new AbortController();

  const createFetchFallbackPromise = async (url: string, index: number) => {
    if (index >= 0) {
      // To avoid wasting bandwidth, we will wait for a few time before downloading from the fallback URL.
      try {
        await waitWithAbort(1800 + (index + 1) * 1200, controller.signal);
      } catch {
        console.log(picocolors.gray('[fetch cancelled early]'), picocolors.gray(url));
        throw reusedCustomAbortError;
      }
    }
    if (controller.signal.aborted) {
      console.log(picocolors.gray('[fetch cancelled]'), picocolors.gray(url));
      throw reusedCustomAbortError;
    }
    if (index >= 0) {
      console.log(picocolors.yellowBright('[fetch fallback begin]'), picocolors.gray(url));
    }

    // we don't queue add here
    const res = await $$fetch(url, { signal: controller.signal, ...defaultRequestInit });

    let stream = nullthrow(res.body, url + ' has an empty body')
      .pipeThrough(new TextDecoderStream())
      .pipeThrough(new TextLineStream({ skipEmptyLines: processLine }));
    if (processLine) {
      stream = stream.pipeThrough(new ProcessLineStream());
    }
    if (filterAdGuardUnsupportedLines) {
      stream = stream.pipeThrough(new AdGuardFilterIgnoreUnsupportedLinesStream());
    }

    // we does queue during downloading
    const arr = await queue.add(() => Array.fromAsync(stream));

    if (arr.length < 1 && !allowEmpty) {
      throw new ResponseError(res, url, 'empty response w/o 304');
    }

    controller.abort();
    return arr;
  };

  const primaryPromise = createFetchFallbackPromise(url, -1);

  if (!fallbackUrls || fallbackUrls.length === 0) {
    return primaryPromise;
  }
  return Promise.any(
    appendArrayInPlace(
      [primaryPromise],
      fallbackUrls.map(createFetchFallbackPromise)
    )
  );
}
