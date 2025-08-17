import fs from 'node:fs';
import readline from 'node:readline';

import { TextLineStream } from 'foxts/text-line-stream';
import type { ReadableStream } from 'node:stream/web';
import { TextDecoderStream } from 'node:stream/web';
import { processLine, ProcessLineStream } from './process-line';
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

export async function readFileIntoProcessedArray(file: string /* | FileHandle */) {
  const results = [];
  let processed: string | null = '';
  for await (const line of readFileByLine(file)) {
    processed = processLine(line);
    if (processed) {
      results.push(processed);
    }
  }
  return results;
}
