import path, { dirname } from 'path';
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

const OUTPUT_SURGE_DIR = path.resolve(__dirname, '../../List');
const OUTPUT_CLASH_DIR = path.resolve(__dirname, '../../Clash');
const OUTPUT_SINGBOX_DIR = path.resolve(__dirname, '../../sing-box');

export const output = (id: string, type: 'non_ip' | 'ip' | 'domainset') => {
  return [
    path.join(OUTPUT_SURGE_DIR, type, id + '.conf'),
    path.join(OUTPUT_CLASH_DIR, type, id + '.txt'),
    path.join(OUTPUT_SINGBOX_DIR, type, id + '.json')
  ] as const;
};
