const MAX_BLOCK_SIZE = 65535; // max parameter array size for use in Webkit

export function appendArrayInPlace<T>(dest: T[], source: T[]) {
  let offset = 0;
  let itemsLeft = source.length;

  if (itemsLeft <= MAX_BLOCK_SIZE) {
    // eslint-disable-next-line prefer-spread -- performance
    dest.push.apply(dest, source);
  } else {
    while (itemsLeft > 0) {
      const pushCount = Math.min(MAX_BLOCK_SIZE, itemsLeft);
      const subSource = source.slice(offset, offset + pushCount);
      // eslint-disable-next-line prefer-spread -- performance
      dest.push.apply(dest, subSource);
      itemsLeft -= pushCount;
      offset += pushCount;
    }
  }
  return dest;
}

export const appendArrayInPlaceCurried = <T>(dest: T[]) => (source: T[]) => appendArrayInPlace(dest, source);
