import path, { dirname } from 'node:path';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { OUTPUT_CLASH_DIR, OUTPUT_SINGBOX_DIR, OUTPUT_SURGE_DIR } from '../constants/dir';

export const isTruthy = <T>(i: T | 0 | '' | false | null | undefined): i is T => !!i;

export const fastStringArrayJoin = (arr: string[], sep: string) => {
  let result = '';
  for (let i = 0, len = arr.length; i < len; i++) {
    if (i !== 0) {
      result += sep;
    }
    result += arr[i];
  }
  return result;
};

interface Write {
  (
    destination: string,
    input: NodeJS.TypedArray | string,
  ): Promise<unknown>
}

export const mkdirp = (dir: string) => {
  if (fs.existsSync(dir)) {
    return;
  }
  return fsp.mkdir(dir, { recursive: true });
};

export const writeFile: Write = async (destination: string, input, dir = dirname(destination)) => {
  const p = mkdirp(dir);
  if (p) {
    await p;
  }
  return fsp.writeFile(destination, input, { encoding: 'utf-8' });
};

export const removeFiles = async (files: string[]) => Promise.all(files.map((file) => fsp.rm(file, { force: true })));

export const domainWildCardToRegex = (domain: string) => {
  let result = '^';
  for (let i = 0, len = domain.length; i < len; i++) {
    switch (domain[i]) {
      case '.':
        result += String.raw`\.`;
        break;
      case '*':
        result += '[a-zA-Z0-9-_.]*?';
        break;
      case '?':
        result += '[a-zA-Z0-9-_.]';
        break;
      default:
        result += domain[i];
    }
  }
  result += '$';
  return result;
};

export const output = (id: string, type: 'non_ip' | 'ip' | 'domainset') => {
  return [
    path.join(OUTPUT_SURGE_DIR, type, id + '.conf'),
    path.join(OUTPUT_CLASH_DIR, type, id + '.txt'),
    path.join(OUTPUT_SINGBOX_DIR, type, id + '.json')
  ] as const;
};
