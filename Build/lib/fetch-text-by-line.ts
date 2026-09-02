import fs from 'node:fs';
import readline from 'node:readline';

import { TextLineStream } from 'foxts/text-line-stream';
import type { ReadableStream } from 'node:stream/web';
import { TextDecoderStream } from 'node:stream/web';
import { processLine as processLineFn, ProcessLineStream } from './process-line';
import { $$fetch } from './fetch-retry';
import type { UndiciResponseData } from './fetch-retry';
import type { Response as UnidiciWebResponse } from 'undici';
import { invariant } from 'foxts/guard';

export function readFileByLine(file: string): AsyncIterable<string> {
  return readline.createInterface({
    input: fs.createReadStream(file/* , { encoding: 'utf-8' } */),
    crlfDelay: Infinity
  });
}

export const createReadlineInterfaceFromResponse: ((resp: UndiciResponseData | UnidiciWebResponse, processLine?: boolean) => ReadableStream<string>) = (resp, processLine = false) => {
  invariant(resp.body, 'Failed to fetch remote text');
  if ('bodyUsed' in resp && resp.bodyUsed) {
    throw new Error('Body has already been consumed.');
  }
  let webStream: ReadableStream<Uint8Array>;
  if ('pipeThrough' in resp.body) {
    webStream = resp.body;
  } else {
    throw new TypeError('Invalid response body!');
  }

  const resultStream = webStream
    // @ts-expect-error -- mismatched Node.js and web types
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(new TextLineStream({ skipEmptyLines: processLine }));

  if (processLine) {
    return resultStream.pipeThrough(new ProcessLineStream());
  }
  return resultStream;
};

export function fetchRemoteTextByLine(url: string, processLine = false): Promise<AsyncIterable<string>> {
  return $$fetch(url).then(resp => createReadlineInterfaceFromResponse(resp, processLine));
}

export function splitTextIntoLines(
  text: string,
  processLine = false,
  filter: ((line: string) => string | null) | null = null
): string[] {
  const lines: string[] = [];
  const len = text.length;
  let start = 0;

  while (start <= len) {
    let end = text.indexOf('\n', start);
    const next = end === -1 ? len + 1 : end + 1;
    if (end === -1) {
      end = len;
    }
    if (end > start && text.charCodeAt(end - 1) === 13 /* \r */) {
      end--;
    }

    if (end > start || (!processLine && start < len)) {
      let line: string | null = text.slice(start, end);
      if (filter) {
        line = filter(line);
      }
      if (line !== null && processLine) {
        line = processLineFn(line);
      }
      if (line !== null) {
        lines.push(line);
      }
    }

    start = next;
  }

  return lines;
}

/**
 * Download a text asset and return its lines. The body is buffered and split
 * synchronously -- see {@link splitTextIntoLines} for why that beats streaming
 * when the result is an array anyway.
 */
export async function fetchRemoteTextLines(url: string, processLine = false): Promise<string[]> {
  const resp = await $$fetch(url);
  return splitTextIntoLines(await resp.text(), processLine);
}

export async function readFileIntoProcessedArray(file: string /* | FileHandle */) {
  const results = [];
  let processed: string | null = '';
  for await (const line of readFileByLine(file)) {
    processed = processLineFn(line);
    if (processed) {
      results.push(processed);
    }
  }
  return results;
}
