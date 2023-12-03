import type { BunFile } from 'bun';
import { fetchWithRetry, defaultRequestInit } from './fetch-retry';
// import { TextLineStream } from './text-line-transform-stream';
// import { PolyfillTextDecoderStream } from './text-decoder-stream';

// export function readFileByLine(file: string | BunFile) {
//   if (typeof file === 'string') {
//     file = Bun.file(file);
//   }
//   return file.stream().pipeThrough(new PolyfillTextDecoderStream()).pipeThrough(new TextLineStream());
// }

// export function createReadlineInterfaceFromResponse(resp: Response) {
//   if (!resp.body) {
//     throw new Error('Failed to fetch remote text');
//   }
//   if (resp.bodyUsed) {
//     throw new Error('Body has already been consumed.');
//   }

//   return (resp.body as ReadableStream<Uint8Array>).pipeThrough(new PolyfillTextDecoderStream()).pipeThrough(new TextLineStream());
// }

const decoder = new TextDecoder('utf-8');

export async function *readFileByLine(file: string | BunFile): AsyncGenerator<string> {
  if (typeof file === 'string') {
    file = Bun.file(file);
  }

  let buf = '';

  for await (const chunk of file.stream()) {
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

export async function *createReadlineInterfaceFromResponse(resp: Response): AsyncGenerator<string> {
  if (!resp.body) {
    throw new Error('Failed to fetch remote text');
  }
  if (resp.bodyUsed) {
    throw new Error('Body has already been consumed.');
  }

  let buf = '';

  for await (const chunk of resp.body) {
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

export function fetchRemoteTextAndCreateReadlineInterface(url: string | URL) {
  return fetchWithRetry(url, defaultRequestInit).then(res => createReadlineInterfaceFromResponse(res as Response));
}
