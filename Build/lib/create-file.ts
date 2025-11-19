import { asyncWriteToStream } from 'foxts/async-write-to-stream';
import { fastStringArrayJoin } from 'foxts/fast-string-array-join';
import fs from 'node:fs';
import picocolors from 'picocolors';
import type { Span } from '../trace';
import { readFileByLine } from './fetch-text-by-line';
import { writeFile } from './misc';
import { createCompareSource, fileEqualWithCommentComparator } from 'foxts/compare-source';

export const fileEqual = createCompareSource(fileEqualWithCommentComparator);

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
    // most likely less than 250 lines
    if (linesALen < 250) {
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
