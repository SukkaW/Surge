import type { BunFile } from 'bun';
import { fetchWithRetry, defaultRequestInit } from './fetch-retry';
import { TextLineStream } from './text-line-transform-stream';
import { PolyfillTextDecoderStream } from './text-decoder-stream';

export function readFileByLine(file: string | BunFile) {
  if (typeof file === 'string') {
    file = Bun.file(file);
  }
  return file.stream().pipeThrough(new PolyfillTextDecoderStream()).pipeThrough(new TextLineStream());
}

export async function createReadlineInterfaceFromResponse(resp: Response) {
  if (!resp.body) {
    throw new Error('Failed to fetch remote text');
  }
  if (resp.bodyUsed) {
    throw new Error('Body has already been consumed.');
  }

  return (resp.body as ReadableStream<Uint8Array>).pipeThrough(new PolyfillTextDecoderStream()).pipeThrough(new TextLineStream());
}

export function fetchRemoteTextAndCreateReadlineInterface(url: string | URL) {
  return fetchWithRetry(url, defaultRequestInit).then(res => createReadlineInterfaceFromResponse(res));
}
