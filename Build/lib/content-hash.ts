import { fastStringArrayJoin } from 'foxts/fast-string-array-join';
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import fsp from 'node:fs/promises';

/**
 * A special marker embedded in the metadata comment of output files, carrying the hash
 * of the "real content" (title, description and rules -- but not the volatile
 * "Last Updated" date). This way, whether a file needs to be re-written can be
 * determined by reading only the first few hundred bytes of the previous output
 * when possible.
 *
 * If the hash algorithm or what's included in the hash ever changes, bump the
 * version suffix to force a one-time re-write of every file.
 */
const CONTENT_HASH_MARKER_START = '$content-hash-v1$:';
const CONTENT_HASH_MARKER_END = '$';

/**
 * Hash the real content and return the ready-to-embed, self-delimited token,
 * e.g. `$content-hash-v1$:AbCd...$`. Writers only need to prepend their own
 * comment prefix (`# ` / `! `).
 */
export function calculateContentHash(title: string, description: string[] | readonly string[], content: string[]): string {
  const hasher = createHash('sha256');
  hasher.update(title);
  hasher.update('\0');
  hasher.update(fastStringArrayJoin(description, '\n'));
  hasher.update('\0');
  hasher.update(fastStringArrayJoin(content, '\n'));
  return CONTENT_HASH_MARKER_START + hasher.digest('base64url') + CONTENT_HASH_MARKER_END;
}

/**
 * The content hash token sits at the bottom of the leading metadata comment,
 * so reading the first chunk of the file is enough to locate it. The chunk must
 * be larger than the biggest banner (title + description + data sources, ~2.2 KiB
 * as of writing) -- if the token falls outside the chunk, extraction returns null
 * and the caller silently degrades to the full file comparison.
 */
const FILE_HEAD_CHUNK_SIZE = 8192;

async function readFileHead(filePath: string): Promise<string> {
  let fd: fsp.FileHandle | null = null;
  try {
    fd = await fsp.open(filePath, 'r');
    const buf = Buffer.allocUnsafe(FILE_HEAD_CHUNK_SIZE);
    const { bytesRead } = await fd.read(buf, 0, FILE_HEAD_CHUNK_SIZE, 0);
    return buf.toString('utf8', 0, bytesRead);
  } finally {
    await fd?.close();
  }
}

/**
 * Extract the content hash token from a previously written file, reading only
 * the first chunk of it. Returns the same self-delimited token shape that
 * calculateContentHash produces, so the two can be compared directly. Returns
 * null if the file predates the content hash marker, or if the token is
 * malformed / truncated by the fixed-size head read (in which case the caller
 * falls back to the full comparison, which is always safe).
 */
export async function extractContentHashFromFile(filePath: string): Promise<string | null> {
  return extractContentHash(await readFileHead(filePath));
}

function extractContentHash(fileHead: string): string | null {
  const markerIndex = fileHead.indexOf(CONTENT_HASH_MARKER_START);
  if (markerIndex === -1) {
    return null;
  }

  const start = markerIndex + CONTENT_HASH_MARKER_START.length;
  const end = fileHead.indexOf(CONTENT_HASH_MARKER_END, start);
  // also covers end === -1 (unterminated token) and end === start (empty hash)
  if (end <= start) {
    return null;
  }

  // the end marker must sit on the same line as the start marker
  if (fileHead.slice(start, end).includes('\n')) {
    return null;
  }

  return fileHead.slice(markerIndex, end + CONTENT_HASH_MARKER_END.length);
}
