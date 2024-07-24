import fs from 'fs';
import { Readable } from 'stream';
import { fetchWithRetry, defaultRequestInit } from './fetch-retry';
import type { FileHandle } from 'fs/promises';

import { TextLineStream } from './text-line-transform-stream';
import type { ReadableStream } from 'stream/web';
import { TextDecoderStream } from 'stream/web';
import { processLine } from './process-line';

const getReadableStream = (file: string | FileHandle): ReadableStream => {
  if (typeof file === 'string') {
    return Readable.toWeb(fs.createReadStream(file/* , { encoding: 'utf-8' } */));
  }
  return file.readableWebStream();
};
// TODO: use FileHandle.readLine()
export const readFileByLine: ((file: string | FileHandle) => AsyncIterable<string>) = (file: string | FileHandle) => getReadableStream(file)
  .pipeThrough(new TextDecoderStream())
  .pipeThrough(new TextLineStream());

const ensureResponseBody = (resp: Response) => {
  if (!resp.body) {
    throw new Error('Failed to fetch remote text');
  }
  if (resp.bodyUsed) {
    throw new Error('Body has already been consumed.');
  }
  return resp.body;
};

export const createReadlineInterfaceFromResponse: ((resp: Response) => AsyncIterable<string>) = (resp) => ensureResponseBody(resp)
  .pipeThrough(new TextDecoderStream())
  .pipeThrough(new TextLineStream());

export function fetchRemoteTextByLine(url: string | URL) {
  return fetchWithRetry(url, defaultRequestInit).then(createReadlineInterfaceFromResponse);
}

export async function readFileIntoProcessedArray(file: string | FileHandle) {
  const results = [];
  for await (const line of readFileByLine(file)) {
    if (processLine(line)) {
      results.push(line);
    }
  }
  return results;
}
