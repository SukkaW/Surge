import { fastStringArrayJoin } from 'foxts/fast-string-array-join';
import fs from 'node:fs';
import path from 'node:path';
import picocolors from 'picocolors';
import { SpanCategory } from '../trace';
import type { Span } from '../trace';
import { readFileByLine } from './fetch-text-by-line';
import { writeFile } from './misc';
import { createCompareSource, fileEqualWithCommentComparator } from 'foxts/compare-source';
import { extractContentHashFromFile } from './content-hash';

const fileEqual = createCompareSource(fileEqualWithCommentComparator);

/**
 * The comparison half shared by {@link compareAndWriteFile} and
 * {@link compareAndWriteFileInWorker} -- there is exactly one implementation of
 * "is the previous output already up to date", regardless of how the new content
 * ends up being written.
 */
async function isPreviousOutputEqual(span: Span, linesA: string[], filePath: string, contentHash: string | null) {
  // readFileByLine will not include last empty line. So we always pop the linesA for comparison purpose
  if (linesA.length > 0 && linesA.at(-1) === '') {
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
  }, SpanCategory.FsRead);

  if (isEqual) {
    console.log(picocolors.gray(picocolors.dim(`same content, bail out writing: ${filePath}`)));
  }

  return isEqual;
}

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
  if (await isPreviousOutputEqual(span, linesA, filePath, contentHash)) {
    return;
  }

  return writeFileLines(span, linesA, filePath);
}

/**
 * Same comparison as {@link compareAndWriteFile}, but the write itself is
 * synchronous. For worker threads only: blocking a dedicated worker is free,
 * whereas an async write hands the completion back through libuv to an event
 * loop we would rather not depend on being idle.
 */
export async function compareAndWriteFileInWorker(span: Span, linesA: string[], filePath: string, contentHash: string | null = null) {
  if (await isPreviousOutputEqual(span, linesA, filePath, contentHash)) {
    return;
  }

  writeFileLinesSync(span, linesA, filePath);
}

export function writeFileLines(span: Span, linesA: string[], filePath: string): Promise<void> {
  return span.traceChildAsync<void>(
    `writing ${filePath}`,
    () => writeFile(filePath, fastStringArrayJoin(linesA, '\n') + '\n'),
    SpanCategory.FsWrite
  );
}

export function writeFileLinesSync(span: Span, linesA: string[], filePath: string): void {
  span.traceChildSync(`writing ${filePath}`, () => {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, fastStringArrayJoin(linesA, '\n') + '\n');
  }, SpanCategory.FsWrite);
}
