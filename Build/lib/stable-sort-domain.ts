import * as tldts from 'tldts';
import { sort } from './timsort';

export const compare = (a: string, b: string) => {
  if (a === b) return 0;

  const aLen = a.length;
  const r = aLen - b.length;
  if (r > 0) {
    return 1;
  }
  if (r < 0) {
    return -1;
  }

  for (let i = 0; i < aLen; i++) {
    // if (b[i] == null) {
    //   return 1;
    // }
    if (a[i] < b[i]) {
      return -1;
    }
    if (a[i] > b[i]) {
      return 1;
    }
  }
  return 0;
};

const tldtsOpt = { allowPrivateDomains: false, detectIp: false, validateHostname: false };

export const sortDomains = (inputs: string[]) => {
  const domains = inputs.reduce<Map<string, string>>((acc, cur) => {
    if (!acc.has(cur)) {
      const topD = tldts.getDomain(cur, tldtsOpt);
      acc.set(cur, topD ?? cur);
    };
    return acc;
  }, new Map());

  const sorter = (a: string, b: string) => {
    if (a === b) return 0;

    const $a = domains.get(a)!;
    const $b = domains.get(b)!;

    if (a === $a && b === $b) {
      return compare(a, b);
    }
    return compare($a, $b) || compare(a, b);
  };

  sort(inputs, sorter);

  return inputs;
};
