import { asyncWriteToStream } from 'foxts/async-write-to-stream';
import { fastStringArrayJoin } from 'foxts/fast-string-array-join';
import fs from 'node:fs';
import picocolors from 'picocolors';
import type { Span } from '../trace';
import { readFileByLine } from './fetch-text-by-line';
import { writeFile } from './misc';
import { invariant } from 'foxts/guard';

export async function fileEqual(linesA: string[], source: AsyncIterable<string> | Iterable<string>): Promise<boolean> {
  if (linesA.length === 0) {
    return false;
  }

  const aLen = linesA.length;

  const maxIndexA = aLen - 1;
  let index = -1;

  const iterator = Symbol.asyncIterator in source
    ? source[Symbol.asyncIterator]()
    : (
      Symbol.iterator in source
        ? source[Symbol.iterator]()
        : null
    );

  invariant(iterator, 'source must be iterable or async iterable');

  let result = await iterator.next();
  let lineB: string = result.value;

  while (!result.done) {
    index++;

    // b become bigger
    if (index === aLen) {
      return false;
    }

    const lineA = linesA[index];

    if (lineA.length === 0) {
      if (lineB.length === 0) {
      // eslint-disable-next-line no-await-in-loop -- sequential
        result = await iterator.next();
        lineB = result.value;
        continue;
      }
      return false;
    }

    const aFirstChar = lineA.charCodeAt(0);
    if (aFirstChar !== lineB.charCodeAt(0)) {
      return false;
    }

    // Now both line has the same first char
    // We only need to compare one of them
    if (
      aFirstChar === 35 // #
      || aFirstChar === 33 // !
    ) {
      // eslint-disable-next-line no-await-in-loop -- sequential
      result = await iterator.next();
      lineB = result.value;
      continue;
    }

    if (lineA !== lineB) {
      return false;
    }

    // eslint-disable-next-line no-await-in-loop -- sequential
    result = await iterator.next();
    lineB = result.value;
  }

  // b is not smaller than a
  return index === maxIndexA;
}

export async function compareAndWriteFile(span: Span, linesA: string[], filePath: string) {
  const isEqual = await span.traceChildAsync(`compare ${filePath}`, async () => {
    if (fs.existsSync(filePath)) {
      return fileEqual(linesA, readFileByLine(filePath));
    }

    console.log(`${filePath} does not exists, writing...`);
    return false;
  });

  if (isEqual) {
    console.log(picocolors.gray(picocolors.dim(`same content, bail out writing: ${filePath}`)));
    return;
  }

  return span.traceChildAsync<void>(`writing ${filePath}`, async () => {
    const linesALen = linesA.length;

    // The default highwater mark is normally 16384,
    // So we make sure direct write to file if the content is
    // most likely less than 500 lines
    if (linesALen < 500) {
      return writeFile(filePath, fastStringArrayJoin(linesA, '\n') + '\n');
    }

    const writeStream = fs.createWriteStream(filePath);
    for (let i = 0; i < linesALen; i++) {
      const p = asyncWriteToStream(writeStream, linesA[i] + '\n');
      // eslint-disable-next-line no-await-in-loop -- stream high water mark
      if (p) await p;
    }

    writeStream.end();
    writeStream.close();
  });
}
