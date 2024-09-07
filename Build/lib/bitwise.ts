/** Packs two 16-bit integers into one 32-bit integer */
export const pack = (a: number, b: number): number => {
  return (a << 16) | b;
};

/** Unpacks two 16-bit integers from one 32-bit integer */
export const unpack = (value: number): [a: number, b: number] => {
  return [(value >> 16) & 0xFFFF, value & 0xFFFF];
};
