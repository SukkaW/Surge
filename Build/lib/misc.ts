import { dirname } from 'path';
import fs from 'fs';
import fsp from 'fs/promises';
import { makeRe } from 'picomatch';

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

export const writeFile: Write = async (destination: string, input, dir = dirname(destination)) => {
  if (!fs.existsSync(dir)) {
    await fsp.mkdir(dir, { recursive: true });
  }
  return fsp.writeFile(destination, input, { encoding: 'utf-8' });
};

export const domainWildCardToRegex = (domain: string) => {
  return makeRe(domain, { contains: false, strictSlashes: true }).source;
};
