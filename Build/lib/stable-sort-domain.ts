import type { PublicSuffixList } from '@gorhill/publicsuffixlist';
import { createCachedGorhillGetDomain } from './cached-tld-parse';

const compare = (a: string | null, b: string | null) => {
  if (a === b) return 0;
  if (b == null) {
    return 1;
  }
  if (a == null) {
    return -1;
  }

  const aLen = a.length;
  const r = aLen - b.length;
  if (r > 0) {
    return 1;
  }
  if (r < 0) {
    return -1;
  }

  for (let i = 0; i < aLen; i++) {
    if (b[i] == null) {
      return 1;
    }
    if (a[i] < b[i]) {
      return -1;
    }
    if (a[i] > b[i]) {
      return 1;
    }
  }
  return 0;
};

export const sortDomains = (inputs: string[], gorhill: PublicSuffixList) => {
  const getDomain = createCachedGorhillGetDomain(gorhill);
  const domains = inputs.reduce<Map<string, string>>((acc, cur) => {
    if (!acc.has(cur)) acc.set(cur, getDomain(cur));
    return acc;
  }, new Map());

  const sorter = (a: string, b: string) => {
    if (a === b) return 0;
    return compare(domains.get(a)!, domains.get(b)!) || compare(a, b);
  };

  return inputs.sort(sorter);
};
