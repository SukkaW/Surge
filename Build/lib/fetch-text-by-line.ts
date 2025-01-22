import fs from 'node:fs';
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
import { invariant } from 'foxts/guard';

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
