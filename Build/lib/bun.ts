import { dirname } from 'path';
import fs from 'fs';
import fsp from 'fs/promises';

interface Peek {
  <T = undefined>(promise: T | Promise<T>): Promise<T> | T,
  status<T = undefined>(
    promise: T | Promise<T>,
  ): 'pending' | 'fulfilled' | 'rejected' | 'unknown'
}

const noopPeek = <T = undefined>(_: Promise<T>) => _;
noopPeek.status = () => 'unknown';

export const peek: Peek = typeof Bun !== 'undefined'
  ? Bun.peek
  : noopPeek as Peek;

interface Write {
  (
    destination: string,
    input: NodeJS.TypedArray | string,
  ): Promise<unknown>
}

export const writeFile: Write = typeof Bun !== 'undefined'
  ? Bun.write
  : (async (destination: string, input) => {
    const dir = dirname(destination);

    if (!fs.existsSync(dir)) {
      await fsp.mkdir(dir, { recursive: true });
    }
    return fsp.writeFile(destination, input, { encoding: 'utf-8' });
  });
