import { dirname } from 'path';
import fs from 'fs';
import fsp from 'fs/promises';

const peekStatus = new WeakMap<Promise<any>, 'pending' | 'rejected' | 'fulfilled'>();
export function track<T>(promise: Promise<T>): Promise<T> {
  // only set to pending if not already tracked
  if (!peekStatus.has(promise)) {
    peekStatus.set(promise, 'pending');
  }

  // Observe the promise, saving the fulfillment in a closure scope.
  return promise.then(
    (v) => {
      peekStatus.set(promise, 'fulfilled');
      return v;
    },
    (e) => {
      peekStatus.set(promise, 'rejected');
      throw e;
    }
  );
}

export function peek(promise: Promise<any>): 'pending' | 'rejected' | 'fulfilled' | 'unknown' {
  return peekStatus.get(promise) ?? 'unknown';
}

interface Write {
  (
    destination: string,
    input: NodeJS.TypedArray | string,
  ): Promise<unknown>
}

export const writeFile: Write = async (destination: string, input) => {
  const dir = dirname(destination);

  if (!fs.existsSync(dir)) {
    await fsp.mkdir(dir, { recursive: true });
  }
  return fsp.writeFile(destination, input, { encoding: 'utf-8' });
};
