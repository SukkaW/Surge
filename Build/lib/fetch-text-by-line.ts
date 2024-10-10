import fs from 'node:fs';
import { Readable } from 'node:stream';
import type { FileHandle } from 'node:fs/promises';

import { TextLineStream } from './text-line-transform-stream';
import type { ReadableStream } from 'node:stream/web';
import { TextDecoderStream } from 'node:stream/web';
import { processLine } from './process-line';
import { $fetch } from './make-fetch-happen';
import type { NodeFetchResponse } from './make-fetch-happen';

function getReadableStream(file: string | FileHandle): ReadableStream {
  if (typeof file === 'string') {
    // return fs.openAsBlob(file).then(blob => blob.stream())
    return Readable.toWeb(fs.createReadStream(file/* , { encoding: 'utf-8' } */));
  }
  return file.readableWebStream();
}
// TODO: use FileHandle.readLine()
export const readFileByLine: ((file: string | FileHandle) => AsyncIterable<string>) = (file: string | FileHandle) => getReadableStream(file)
  .pipeThrough(new TextDecoderStream())
  .pipeThrough(new TextLineStream());

function ensureResponseBody<T extends Response | NodeFetchResponse>(resp: T): NonNullable<T['body']> {
  if (!resp.body) {
    throw new Error('Failed to fetch remote text');
  }
  if (resp.bodyUsed) {
    throw new Error('Body has already been consumed.');
  }
  return resp.body;
}

export const createReadlineInterfaceFromResponse: ((resp: Response | NodeFetchResponse) => AsyncIterable<string>) = (resp) => {
  const stream = ensureResponseBody(resp);

  const webStream: ReadableStream<Uint8Array> = 'getReader' in stream
    ? stream
    : Readable.toWeb(new Readable().wrap(stream)) as any;

  return webStream
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(new TextLineStream());
};

export function fetchRemoteTextByLine(url: string) {
  return $fetch(url).then(createReadlineInterfaceFromResponse);
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
