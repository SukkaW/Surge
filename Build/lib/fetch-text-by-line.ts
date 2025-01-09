import fs from 'node:fs';
import { Readable } from 'node:stream';
import fsp from 'node:fs/promises';
import type { FileHandle } from 'node:fs/promises';
import readline from 'node:readline';

import { TextLineStream } from './text-line-transform-stream';
import type { ReadableStream } from 'node:stream/web';
import { TextDecoderStream } from 'node:stream/web';
import { processLine, ProcessLineStream } from './process-line';
import { $$fetch } from './fetch-retry';
import type { UndiciResponseData } from './fetch-retry';
import type { Response as UnidiciWebResponse } from 'undici';

function getReadableStream(file: string | FileHandle): ReadableStream {
  if (typeof file === 'string') {
    // return fs.openAsBlob(file).then(blob => blob.stream())
    return Readable.toWeb(fs.createReadStream(file/* , { encoding: 'utf-8' } */));
  }
  return file.readableWebStream();
}

// TODO: use FileHandle.readLine()
export const readFileByLineLegacy: ((file: string /* | FileHandle */) => AsyncIterable<string>) = (file: string | FileHandle) => getReadableStream(file)
  .pipeThrough(new TextDecoderStream())
  .pipeThrough(new TextLineStream());

export function readFileByLine(file: string): AsyncIterable<string> {
  return readline.createInterface({
    input: fs.createReadStream(file/* , { encoding: 'utf-8' } */),
    crlfDelay: Infinity
  });
}

const fdReadLines = (fd: FileHandle) => fd.readLines();
export async function readFileByLineNew(file: string): Promise<AsyncIterable<string>> {
  return fsp.open(file, 'r').then(fdReadLines);
}

function ensureResponseBody<T extends UndiciResponseData | UnidiciWebResponse>(resp: T): NonNullable<T['body']> {
  if (resp.body == null) {
    throw new Error('Failed to fetch remote text');
  }
  if ('bodyUsed' in resp && resp.bodyUsed) {
    throw new Error('Body has already been consumed.');
  }
  return resp.body;
}

export const createReadlineInterfaceFromResponse: ((resp: UndiciResponseData | UnidiciWebResponse, processLine?: boolean) => ReadableStream<string>) = (resp, processLine = false) => {
  const stream = ensureResponseBody(resp);

  const webStream: ReadableStream<Uint8Array> = 'getReader' in stream
    ? stream
    : (
      'text' in stream
        ? stream.body as any
        : Readable.toWeb(new Readable().wrap(stream))
    );

  const resultStream = webStream
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(new TextLineStream());

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
  for await (const line of readFileByLine(file)) {
    if (processLine(line)) {
      results.push(line);
    }
  }
  return results;
}
