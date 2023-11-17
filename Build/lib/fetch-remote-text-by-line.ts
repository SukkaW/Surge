import type { BunFile } from 'bun';
import { fetchWithRetry } from './fetch-retry';

const decoder = new TextDecoder('utf-8');

export async function* readFileByLine(file: string | BunFile): AsyncGenerator<string> {
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

export async function* createReadlineInterfaceFromResponse(resp: Response): AsyncGenerator<string> {
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

export function fetchRemoteTextAndCreateReadlineInterface(url: string | URL, opt?: RequestInit): Promise<AsyncGenerator<string>> {
  return fetchWithRetry(url, opt).then(res => createReadlineInterfaceFromResponse(res));
}
