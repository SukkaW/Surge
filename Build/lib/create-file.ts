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

  const maxIndexA = linesA.length - 1;
  let index = -1;

  for await (const lineB of source) {
    index++;

    if (index > maxIndexA) {
      return false;
    }

    const lineA = linesA[index];

    const lineAIsComment = isCommentLine(lineA);
    const lineBIsComment = isCommentLine(lineB);

    if (lineAIsComment !== lineBIsComment) {
      return false;
    }

    // Now both line are either both comment or both not comment
    // We only need to compare one of them
    if (lineAIsComment) {
      continue;
    }

    if (lineA !== lineB) {
      return false;
    }
  }

  return index === maxIndexA;
}

export function isCommentLine(line: string): boolean {
  const firstChar = line.charCodeAt(0);
  return (
    firstChar === 35 // #
    || firstChar === 33 // !
    || (firstChar === 47 && line[1] === '/' && line[3] === '#') // //##
  );
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
    writeStream.close();
  });
}
