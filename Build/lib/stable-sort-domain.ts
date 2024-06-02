// tldts-experimental is way faster than tldts, but very little bit inaccurate
// (since it is hashes based). But the result is still deterministic, which is
// enough when sorting.
import { getDomain, getSubdomain } from 'tldts-experimental';
import { sort } from './timsort';
import { looseTldtsOpt } from '../constants/loose-tldts-opt';

export const compare = (a: string, b: string) => {
  if (a === b) return 0;
  return (a.length - b.length) || a.localeCompare(b);
};

export const buildParseDomainMap = (inputs: string[]) => {
  const domainMap = new Map<string, string>();
  const subdomainMap = new Map<string, string>();

  for (let i = 0, len = inputs.length; i < len; i++) {
    const cur = inputs[i];
    if (!domainMap.has(cur)) {
      const topD = getDomain(cur, looseTldtsOpt);
      domainMap.set(cur, topD ?? cur);
      // if (!subdomainMap.has(cur)) {
      const subD = getSubdomain(cur, looseTldtsOpt);
      subdomainMap.set(cur, subD ?? cur);
    }
  }

  return { domainMap, subdomainMap };
};

export const sortDomains = (
  inputs: string[],
  domainMap?: Map<string, string>,
  subdomainMap?: Map<string, string>
) => {
  if (!domainMap || !subdomainMap) {
    const { domainMap: dm, subdomainMap: sm } = buildParseDomainMap(inputs);
    domainMap = dm;
    subdomainMap = sm;
  }

  for (let i = 0, len = inputs.length; i < len; i++) {
    const cur = inputs[i];
    if (!domainMap.has(cur)) {
      const topD = getDomain(cur, looseTldtsOpt);
      domainMap.set(cur, topD ?? cur);
    }
    if (!subdomainMap.has(cur)) {
      const subD = getSubdomain(cur, looseTldtsOpt);
      subdomainMap.set(cur, subD ?? cur);
    }
  }

  const sorter = (a: string, b: string) => {
    if (a === b) return 0;

    const main_domain_a = domainMap.get(a)!;
    const main_domain_b = domainMap.get(b)!;

    let t = compare(
      main_domain_a,
      main_domain_b
    ) || compare(
      /** subdomain_a */ subdomainMap.get(a)!,
      /** subdomain_b */ subdomainMap.get(b)!
    );
    if (t !== 0) return t;

    if (a !== main_domain_a || b !== main_domain_b) {
      t = compare(a, b);
    }

    return t;
  };

  return sort(inputs, sorter);
};
