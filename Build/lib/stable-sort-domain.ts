import type { PublicSuffixList } from 'gorhill-publicsuffixlist';
import { createCachedGorhillGetDomain } from './cached-tld-parse';

const compare = (a: string | null, b: string | null) => {
  if (a === b) return 0;
  if (b == null) {
    return 1;
  }
  if (a == null) {
    return -1;
  }

  if (a.length !== b.length) {
    const r = a.length - b.length;
    if (r > 0) {
      return 1;
    }
    if (r < 0) {
      return -1;
    }
    return 0;
  }

  for (let i = 0; i < a.length; i++) {
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

const createDomainSorter = (gorhill: PublicSuffixList | null = null) => {
  if (gorhill) {
    const getDomain = createCachedGorhillGetDomain(gorhill);

    return (a: string, b: string) => {
      if (a === b) return 0;

      const aDomain = getDomain(a);
      const bDomain = getDomain(b);

      const resultDomain = compare(aDomain, bDomain);
      return resultDomain !== 0 ? resultDomain : compare(a, b);
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-var-requires -- fuck
  const tldts = require('./cached-tld-parse');

  return (a: string, b: string) => {
    if (a === b) return 0;

    const aDomain = tldts.parse(a).domain;
    const bDomain = tldts.parse(b).domain;

    const resultDomain = compare(aDomain, bDomain);
    return resultDomain !== 0 ? resultDomain : compare(a, b);
  };
};

export default createDomainSorter();
export { createDomainSorter };
