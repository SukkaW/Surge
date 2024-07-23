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
