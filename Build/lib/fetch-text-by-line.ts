import type { BunFile } from 'bun';
import { fetchWithRetry, defaultRequestInit } from './fetch-retry';

import { TextLineStream } from './text-line-transform-stream';
import { PolyfillTextDecoderStream } from './text-decoder-stream';
import { processLine } from './process-line';

const enableTextLineStream = !!process.env.ENABLE_TEXT_LINE_STREAM;

const decoder = new TextDecoder('utf-8');
async function *createTextLineAsyncIterableFromStreamSource(stream: ReadableStream<Uint8Array>): AsyncIterable<string> {
  let buf = '';

  // @ts-expect-error -- ReadableStream<Uint8Array> should be AsyncIterable<Uint8Array>
  for await (const chunk of stream) {
    const chunkStr = decoder.decode(chunk).replaceAll('\r\n', '\n');
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

const getBunBlob = (file: string | URL | BunFile) => {
  if (typeof file === 'string') {
    return Bun.file(file);
  } if (!('writer' in file)) {
    return Bun.file(file);
  }
  return file;
};

// @ts-expect-error -- ReadableStream<string> should be AsyncIterable<string>
export const readFileByLine: ((file: string | URL | BunFile) => AsyncIterable<string>) = enableTextLineStream
  ? (file: string | URL | BunFile) => getBunBlob(file).stream().pipeThrough(new PolyfillTextDecoderStream()).pipeThrough(new TextLineStream())
  : (file: string | URL | BunFile) => createTextLineAsyncIterableFromStreamSource(getBunBlob(file).stream());

const ensureResponseBody = (resp: Response) => {
  if (!resp.body) {
    throw new Error('Failed to fetch remote text');
  }
  if (resp.bodyUsed) {
    throw new Error('Body has already been consumed.');
  }
  return resp.body;
};

// @ts-expect-error -- ReadableStream<string> should be AsyncIterable<string>
export const createReadlineInterfaceFromResponse: ((resp: Response) => AsyncIterable<string>) = enableTextLineStream
  ? (resp) => ensureResponseBody(resp).pipeThrough(new PolyfillTextDecoderStream()).pipeThrough(new TextLineStream())
  : (resp) => createTextLineAsyncIterableFromStreamSource(ensureResponseBody(resp));

export function fetchRemoteTextByLine(url: string | URL) {
  return fetchWithRetry(url, defaultRequestInit).then(createReadlineInterfaceFromResponse);
}

export async function readFileIntoProcessedArray(file: string | URL | BunFile) {
  if (typeof file === 'string') {
    file = Bun.file(file);
  } else if (!('writer' in file)) {
    file = Bun.file(file);
  }

  const content = await file.text();
  return content.split('\n').filter(processLine);
}
