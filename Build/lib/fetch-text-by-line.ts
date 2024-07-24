import fs from 'fs';
import { Readable } from 'stream';
import { fetchWithRetry, defaultRequestInit } from './fetch-retry';
import type { FileHandle } from 'fs/promises';

import { TextLineStream } from './text-line-transform-stream';
import type { ReadableStream } from 'stream/web';
import { TextDecoderStream } from 'stream/web';
import { processLine } from './process-line';

const enableTextLineStream = !!process.env.ENABLE_TEXT_LINE_STREAM;

const decoder = new TextDecoder('utf-8');
async function *createTextLineAsyncIterableFromStreamSource(stream: ReadableStream<Uint8Array>): AsyncIterable<string> {
  let buf = '';

  const reader = stream.getReader();

  while (true) {
    const res = await reader.read();
    if (res.done) {
      break;
    }
    const chunkStr = decoder.decode(res.value).replaceAll('\r\n', '\n');
    for (let i = 0, len = chunkStr.length; i < len; i++) {
      const char = chunkStr[i];
      if (char === '\n') {
        yield buf;
        buf = '';
      } else {
        buf += char;
      }
    }
  }

  if (buf) {
    yield buf;
  }
}

const getReadableStream = (file: string | FileHandle): ReadableStream => {
  if (typeof file === 'string') {
    return Readable.toWeb(fs.createReadStream(file /* { encoding: 'utf-8' } */));
  }
  return file.readableWebStream();
};

// TODO: use FileHandle.readLine()
export const readFileByLine: ((file: string | FileHandle) => AsyncIterable<string>) = enableTextLineStream
  ? (file: string | FileHandle) => getReadableStream(file).pipeThrough(new TextDecoderStream()).pipeThrough(new TextLineStream())
  : (file: string | FileHandle) => createTextLineAsyncIterableFromStreamSource(getReadableStream(file));

const ensureResponseBody = (resp: Response) => {
  if (!resp.body) {
    throw new Error('Failed to fetch remote text');
  }
  if (resp.bodyUsed) {
    throw new Error('Body has already been consumed.');
  }
  return resp.body;
};

export const createReadlineInterfaceFromResponse: ((resp: Response) => AsyncIterable<string>) = enableTextLineStream
  ? (resp) => ensureResponseBody(resp).pipeThrough(new TextDecoderStream()).pipeThrough(new TextLineStream())
  : (resp) => createTextLineAsyncIterableFromStreamSource(ensureResponseBody(resp));

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
