import { dirname } from 'node:path';
import fs from 'node:fs';
import type { PathLike } from 'node:fs';
import fsp from 'node:fs/promises';
import { appendArrayInPlace } from 'foxts/append-array-in-place';

export type MaybePromise<T> = T | Promise<T>;

export function fastStringCompare(a: string, b: string) {
  const lenA = a.length;
  const lenB = b.length;
  const minLen = lenA < lenB ? lenA : lenB;

  for (let i = 0; i < minLen; ++i) {
    const ca = a.charCodeAt(i);
    const cb = b.charCodeAt(i);

    if (ca > cb) return 1;
    if (ca < cb) return -1;
  }

  if (lenA === lenB) {
    return 0;
  }

  return lenA > lenB ? 1 : -1;
};

interface Write {
  (
    destination: string,
    input: NodeJS.TypedArray | string,
  ): Promise<void>
}

export type VoidOrVoidArray = void | VoidOrVoidArray[];

export function mkdirp(dir: string) {
  if (fs.existsSync(dir)) {
    return;
  }
  return fsp.mkdir(dir, { recursive: true });
}

export const writeFile: Write = async (destination: string, input, dir = dirname(destination)): Promise<void> => {
  const p = mkdirp(dir);
  if (p) {
    await p;
  }
  return fsp.writeFile(destination, input, { encoding: 'utf-8' });
};

export function withBannerArray(title: string, description: string[] | readonly string[], date: Date, content: string[]) {
  const result: string[] = [
    '#########################################',
    `# ${title}`,
    `# Last Updated: ${date.toISOString()}`,
    `# Size: ${content.length}`
  ];

  appendArrayInPlace(result, description.map(line => (line ? `# ${line}` : '#')));

  result.push('#########################################');

  appendArrayInPlace(result, content);

  result.push('################## EOF ##################', '');

  return result;
};

export function notSupported(name: string) {
  return (...args: unknown[]) => {
    console.error(`${name}: not supported.`, args);
    throw new Error(`${name}: not implemented.`);
  };
}

export function withIdentityContent(title: string, description: string[] | readonly string[], date: Date, content: string[]) {
  return content;
};

export function isDirectoryEmptySync(path: PathLike) {
  const directoryHandle = fs.opendirSync(path);

  try {
    return directoryHandle.readSync() === null;
  } finally {
    directoryHandle.closeSync();
  }
}
