import { asyncWriteToStream } from 'foxts/async-write-to-stream';
import { fastStringArrayJoin } from 'foxts/fast-string-array-join';
import fs from 'node:fs';
import picocolors from 'picocolors';
import type { Span } from '../trace';
import { readFileByLine } from './fetch-text-by-line';
import { writeFile } from './misc';

export async function fileEqual(linesA: string[], source: AsyncIterable<string> | Iterable<string>): Promise<boolean> {
  if (linesA.length === 0) {
    return false;
  }

  const linesABound = linesA.length - 1;

  let index = -1;

  let aLen = 0;
  let bLen = 0;

  for await (const lineB of source) {
    index++;

    if (index > linesABound) {
      return (index === linesA.length && lineB.length === 0);
    }

    const lineA = linesA[index];
    aLen = lineA.length;
    bLen = lineB.length;

    if (aLen === 0) {
      if (bLen === 0) {
        // both lines are empty, check next line
        continue;
      }
      // lineA is empty but lineB is not
      return false;
    }
    // now lineA can not be empty
    if (bLen === 0) {
      // lineB is empty but lineA is not
      return false;
    }

    // now both lines can not be empty

    const firstCharA = lineA.charCodeAt(0);
    const firstCharB = lineB.charCodeAt(0);

    if (firstCharA !== firstCharB) {
      return false;
    }

    // now firstCharA is equal to firstCharB, we only need to check the first char
    if (firstCharA === 35 /* # */) {
      continue;
    }
    // adguard conf
    if (firstCharA === 33 /* ! */) {
      continue;
    }

    if (
      firstCharA === 47 /* / */
      && lineA[1] === '/' && lineB[1] === '/'
      && lineA[3] === '#' && lineB[3] === '#'
    ) {
      continue;
    }

    if (aLen !== bLen) {
      return false;
    }

    if (lineA !== lineB) {
      return false;
    }
  }

  // The file becomes larger
  return !(index < linesABound);
}

export async function compareAndWriteFile(span: Span, linesA: string[], filePath: string) {
  const linesALen = linesA.length;

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

  await span.traceChildAsync(`writing ${filePath}`, async () => {
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
  });
}
