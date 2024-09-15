import type { Writable } from 'node:stream';
import { once } from 'node:events';

export const asyncWriteToStream = <T>(stream: Writable, chunk: T) => {
  const res = stream.write(chunk);
  if (!res) {
    return once(stream, 'drain'); // returns a promise only if needed
  }
};
