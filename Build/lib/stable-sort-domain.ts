import * as tldts from 'tldts';
import { sort } from './timsort';

export const compare = (a: string, b: string) => {
  if (a === b) return 0;

  const aLen = a.length;
  const r = aLen - b.length;
  if (r !== 0) return r;

  return a.localeCompare(b);
};

const tldtsOpt = { allowPrivateDomains: false, detectIp: false, validateHostname: false };

export const sortDomains = (inputs: string[]) => {
  const domains = inputs.reduce<Map<string, string>>((domains, cur) => {
    if (!domains.has(cur)) {
      const topD = tldts.getDomain(cur, tldtsOpt);
      domains.set(cur, topD ?? cur);
    };
    return domains;
  }, new Map());

  const sorter = (a: string, b: string) => {
    if (a === b) return 0;

    const $a = domains.get(a)!;
    const $b = domains.get(b)!;

    if (a === $a && b === $b) {
      return compare(a, b);
    }
    return $a.localeCompare($b) || compare(a, b);
  };

  sort(inputs, sorter);

  return inputs;
};
