import type { PublicSuffixList } from '@gorhill/publicsuffixlist';

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

export const sortDomains = (inputs: string[], gorhill: PublicSuffixList) => {
  const domains = inputs.reduce<Map<string, string | null>>((acc, cur) => {
    if (!acc.has(cur)) {
      const topD = gorhill.getDomain(cur[0] === '.' ? cur.slice(1) : cur);
      acc.set(cur, topD === cur ? null : topD);
    };
    return acc;
  }, new Map());

  const sorter = (a: string, b: string) => {
    if (a === b) return 0;

    const $a = domains.get(a) || a;
    const $b = domains.get(b) || b;

    return compare($a, $b) || compare(a, b);
  };

  return inputs.sort(sorter);
};
