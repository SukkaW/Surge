import { fastStringArrayJoin } from 'foxts/fast-string-array-join';
import fs from 'node:fs';
import picocolors from 'picocolors';
import type { Span } from '../trace';
import { readFileByLine } from './fetch-text-by-line';
import { writeFile } from './misc';
import { createCompareSource, fileEqualWithCommentComparator } from 'foxts/compare-source';
import { extractContentHashFromFile } from './content-hash';

const fileEqual = createCompareSource(fileEqualWithCommentComparator);

/**
 * To keep metadata comment `last updated` not change if real content is the same,
 * we only write when the actual content differs, and the new `last updated` will
 * be written along with new content.
 *
 * When `contentHash` is provided (and the previous output already embeds a
 * content hash marker), the comparison only reads the first chunk of the
 * previous file. Otherwise it falls back to a full comment-insensitive
 * line-by-line comparison.
 */
export async function compareAndWriteFile(span: Span, linesA: string[], filePath: string, contentHash: string | null = null) {
  // readFileByLine will not include last empty line. So we always pop the linesA for comparison purpose
  if (linesA.length > 0 && linesA[linesA.length - 1] === '') {
    linesA.pop();
  }

  const isEqual = await span.traceChildAsync(`compare ${filePath}`, async () => {
    if (!fs.existsSync(filePath)) {
      console.log(`${filePath} does not exists, writing...`);
      return false;
    }

    if (contentHash) {
      const previousHash = await extractContentHashFromFile(filePath);
      if (previousHash) {
        return previousHash === contentHash;
      }
      // previous output predates the content hash marker, fall through to full comparison
    }

    return fileEqual(linesA, readFileByLine(filePath));
  });

  if (isEqual) {
    console.log(picocolors.gray(picocolors.dim(`same content, bail out writing: ${filePath}`)));
    return;
  }

  return writeFileLines(span, linesA, filePath);
}

export function writeFileLines(span: Span, linesA: string[], filePath: string): Promise<void> {
  return span.traceChildAsync<void>(
    `writing ${filePath}`,
    () => writeFile(filePath, fastStringArrayJoin(linesA, '\n') + '\n')
  );
}
