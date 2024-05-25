import * as tldts from 'tldts';
import { sort } from './timsort';

export const compare = (a: string, b: string) => {
  if (a === b) return 0;
  return (a.length - b.length) || a.localeCompare(b);
};

const tldtsOpt = {
  extractHostname: false,
  allowPrivateDomains: false,
  detectIp: false,
  validateHostname: false,
  mixedInputs: false
};

export const sortDomains = (inputs: string[]) => {
  const domainMap = new Map<string, string>();
  const subdomainMap = new Map<string, string>();

  for (let i = 0, len = inputs.length; i < len; i++) {
    const cur = inputs[i];
    if (!domainMap.has(cur)) {
      const topD = tldts.getDomain(cur, tldtsOpt);
      domainMap.set(cur, topD ?? cur);
    }
    if (!subdomainMap.has(cur)) {
      const subD = tldts.getSubdomain(cur, tldtsOpt);
      subdomainMap.set(cur, subD ?? cur);
    }
  }

  const sorter = (a: string, b: string) => {
    if (a === b) return 0;

    const main_domain_a = domainMap.get(a)!;
    const main_domain_b = domainMap.get(b)!;

    let t = compare(main_domain_a, main_domain_b);

    if (t === 0) {
      const subdomain_a = subdomainMap.get(a)!;
      const subdomain_b = subdomainMap.get(b)!;
      t = compare(subdomain_a, subdomain_b);
    }
    if (t === 0 && (a !== main_domain_a || b !== main_domain_b)) {
      t = compare(a, b);
    }

    return t;
  };

  return sort(inputs, sorter);
};
