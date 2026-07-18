import picocolors from 'picocolors';
import { $$fetch, defaultRequestInit, ResponseError } from './fetch-retry';
import { waitWithAbort } from 'foxts/wait';
import { nullthrow } from 'foxts/guard';
import { TextLineStream } from 'foxts/text-line-stream';
import { ProcessLineStream } from './process-line';
import { AdGuardFilterIgnoreUnsupportedLinesStream } from './parse-filter/filters';
import { appendArrayInPlace } from 'foxts/append-array-in-place';

import { newQueue } from '@henrygd/queue';
import { AbortError, isAbortErrorLike } from 'foxts/abort-error';
import { downloadTimestamp, recordExternalDownloadAttempt } from './download-stats';
import type { ExternalDownloadOutcome } from './download-stats';

const reusedCustomAbortError = new AbortError();

const queue = newQueue(18);

const MIN_HEDGE_DELAY = 3000;
const HEDGE_DELAY_STEP = 1200;
const HEDGE_SPEED_SAMPLE_INTERVAL = 1000;
const HEDGE_QUEUE_POLL_INTERVAL = 250;
// 1 MiB/s is about 8.4 Mbps. A source throttled to 5 Mbps will be hedged,
// while larger responses making healthy progress will not be raced merely
// because their total download time exceeds three seconds.
const MIN_ACCEPTABLE_DOWNLOAD_BYTES_PER_SECOND = 1024 * 1024;

export function isDownloadThroughputSlow(bytesReceived: number, elapsed: number) {
  return bytesReceived / elapsed * 1000 < MIN_ACCEPTABLE_DOWNLOAD_BYTES_PER_SECOND;
}

interface PrimaryDownloadProgress {
  headersReceived: boolean,
  bodyStartedAt: number | null,
  bytesReceived: number,
  failed: boolean
}

export async function fetchAssets(
  url: string, fallbackUrls: null | undefined | string[] | readonly string[],
  processLine = false, allowEmpty = false, filterAdGuardUnsupportedLines = false
) {
  const controller = new AbortController();
  const primaryProgress: PrimaryDownloadProgress = {
    headersReceived: false,
    bodyStartedAt: null,
    bytesReceived: 0,
    failed: false
  };

  const waitForSlowPrimary = async (fallbackIndex: number) => {
    await waitWithAbort(MIN_HEDGE_DELAY + fallbackIndex * HEDGE_DELAY_STEP, controller.signal);

    let sampledAt: number | null = null;
    let sampledBytes = 0;

    while (!controller.signal.aborted) {
      // No response headers after the initial delay, or an explicit primary
      // failure, is sufficient reason to begin the fallback immediately.
      if (!primaryProgress.headersReceived || primaryProgress.failed) {
        return;
      }

      if (primaryProgress.bodyStartedAt == null) {
        // The response is waiting for our local body-consumption queue. This is
        // not an upstream slowdown and should not trigger a duplicate request.
        // eslint-disable-next-line no-await-in-loop -- poll until local consumption starts
        await waitWithAbort(HEDGE_QUEUE_POLL_INTERVAL, controller.signal);
        continue;
      }

      sampledAt ??= primaryProgress.bodyStartedAt;
      const now = performance.now();
      const sampleDuration = now - sampledAt;

      if (sampleDuration < HEDGE_SPEED_SAMPLE_INTERVAL) {
        // eslint-disable-next-line no-await-in-loop -- collect a complete throughput sample
        await waitWithAbort(HEDGE_SPEED_SAMPLE_INTERVAL - sampleDuration, controller.signal);
        continue;
      }

      if (isDownloadThroughputSlow(primaryProgress.bytesReceived - sampledBytes, sampleDuration)) {
        return;
      }

      sampledAt = now;
      sampledBytes = primaryProgress.bytesReceived;
      // eslint-disable-next-line no-await-in-loop -- periodically re-sample a healthy transfer
      await waitWithAbort(HEDGE_SPEED_SAMPLE_INTERVAL, controller.signal);
    }

    throw reusedCustomAbortError;
  };

  const createFetchFallbackPromise = async (url: string, index: number) => {
    if (index >= 0) {
      try {
        await waitForSlowPrimary(index);
      } catch {
        throw reusedCustomAbortError;
      }
    }

    if (controller.signal.aborted) {
      throw reusedCustomAbortError;
    }
    if (index >= 0) {
      console.log(picocolors.yellowBright('[fetch fallback begin]'), picocolors.gray(url));
    }

    const isPrimary = index < 0;
    const attemptStartedAt = downloadTimestamp();
    let headersAt: number | null = null;
    let bodyStartedAt: number | null = null;
    let attemptBytes = 0;
    let finalized = false;

    const finalizeAttempt = (outcome: ExternalDownloadOutcome) => {
      if (finalized) {
        return;
      }
      finalized = true;
      recordExternalDownloadAttempt({
        url,
        kind: isPrimary ? 'primary' : 'fallback',
        outcome,
        startedAt: attemptStartedAt,
        headersAt,
        bodyStartedAt,
        endedAt: downloadTimestamp(),
        bytes: attemptBytes
      });
    };

    try {
      // We intentionally acquire the body-consumption queue after receiving
      // headers. Request scheduling will be handled separately.
      const res = await $$fetch(url, { signal: controller.signal, ...defaultRequestInit });
      headersAt = downloadTimestamp();

      let body = nullthrow(res.body, url + ' has an empty body');
      if (isPrimary) {
        primaryProgress.headersReceived = true;
      }
      body = body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, streamController) {
          attemptBytes += chunk.byteLength;
          if (isPrimary) {
            primaryProgress.bytesReceived += chunk.byteLength;
          }
          streamController.enqueue(chunk);
        }
      }));

      let stream = body
        .pipeThrough(new TextDecoderStream())
        .pipeThrough(new TextLineStream({ skipEmptyLines: processLine }));
      if (processLine) {
        stream = stream.pipeThrough(new ProcessLineStream());
      }
      if (filterAdGuardUnsupportedLines) {
        stream = stream.pipeThrough(new AdGuardFilterIgnoreUnsupportedLinesStream());
      }

      const arr = await queue.add(() => {
        bodyStartedAt = downloadTimestamp();
        if (isPrimary) {
          primaryProgress.bodyStartedAt = performance.now();
        }
        return Array.fromAsync(stream);
      });

      if (arr.length < 1 && !allowEmpty) {
        throw new ResponseError(res, url, 'empty response w/o 304');
      }

      finalizeAttempt('winner');
      controller.abort();
      return arr;
    } catch (error) {
      if (isPrimary) {
        primaryProgress.failed = true;
      }
      finalizeAttempt(isAbortErrorLike(error) ? 'aborted' : 'failed');
      throw error;
    }
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
