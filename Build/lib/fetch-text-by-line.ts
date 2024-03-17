import type { BunFile } from 'bun';
import { fetchWithRetry, defaultRequestInit } from './fetch-retry';

import { TextLineStream } from './text-line-transform-stream';
import { PolyfillTextDecoderStream } from './text-decoder-stream';
import { processLine } from './process-line';

const enableTextLineStream = !!process.env.ENABLE_TEXT_LINE_STREAM;

interface TextLineStreamLike {
  [Symbol.asyncIterator](): AsyncIterableIterator<string>
}

const decoder = new TextDecoder('utf-8');
async function *createTextLineAsyncGeneratorFromStreamSource(stream: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  let buf = '';

  for await (const chunk of stream as any) {
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

export const readFileByLine: ((file: string | URL | BunFile) => TextLineStreamLike) = enableTextLineStream
  ? (file: string | URL | BunFile) => {
    if (typeof file === 'string') {
      file = Bun.file(file);
    } else if (!('writer' in file)) {
      file = Bun.file(file);
    }

    return file.stream().pipeThrough(new PolyfillTextDecoderStream()).pipeThrough(new TextLineStream());
  }
  : (file: string | URL | BunFile) => {
    if (typeof file === 'string') {
      file = Bun.file(file);
    } else if (!('writer' in file)) {
      file = Bun.file(file);
    }

    return createTextLineAsyncGeneratorFromStreamSource(file.stream()) as any;
  };

export const createReadlineInterfaceFromResponse: ((resp: Response) => TextLineStreamLike) = enableTextLineStream
  ? (resp) => {
    if (!resp.body) {
      throw new Error('Failed to fetch remote text');
    }
    if (resp.bodyUsed) {
      throw new Error('Body has already been consumed.');
    }
    return resp.body.pipeThrough(new PolyfillTextDecoderStream()).pipeThrough(new TextLineStream());
  }
  : (resp) => {
    if (!resp.body) {
      throw new Error('Failed to fetch remote text');
    }
    if (resp.bodyUsed) {
      throw new Error('Body has already been consumed.');
    }
    return createTextLineAsyncGeneratorFromStreamSource(resp.body) as any;
  };

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
