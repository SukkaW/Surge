import picocolors from 'picocolors';

const identity = <T>(x: T): T => x;
const unsupported = Symbol('unsupported');

// https://dreamacro.github.io/clash/configuration/rules.html
const PROCESSOR: Record<string, ((raw: string, type: string, value: string) => string) | typeof unsupported> = {
  DOMAIN: identity,
  'DOMAIN-SUFFIX': identity,
  'DOMAIN-KEYWORD': identity,
  GEOIP: identity,
  'IP-CIDR': identity,
  'IP-CIDR6': identity,
  'IP-ASN': identity,
  'SRC-IP-CIDR': identity,
  'SRC-PORT': identity,
  'DST-PORT': identity,
  'PROCESS-NAME': identity,
  'PROCESS-PATH': identity,
  'DEST-PORT': (_raw, type, value) => `DST-PORT,${value}`,
  'IN-PORT': (_raw, type, value) => `SRC-PORT,${value}`,
  'URL-REGEX': unsupported,
  'USER-AGENT': unsupported
};

export const surgeRulesetToClashClassicalTextRuleset = (rules: string[] | Set<string>) => {
  return Array.from(rules).reduce<string[]>((acc, cur) => {
    let buf = '';
    let type = '';
    let i = 0;
    for (const len = cur.length; i < len; i++) {
      if (cur[i] === ',') {
        type = buf;
        break;
      }
      buf += cur[i];
    }
    if (type === '') {
      return acc;
    }
    const value = cur.slice(i + 1);
    if (type in PROCESSOR) {
      const proc = PROCESSOR[type];
      if (proc !== unsupported) {
        acc.push(proc(cur, type, value));
      }
    } else {
      console.log(picocolors.yellow(`[clash] unknown rule type: ${type}`), cur);
    }
    return acc;
  }, []);
};

export const surgeDomainsetToClashDomainset = (domainset: string[]) => {
  return domainset.map(i => (i[0] === '.' ? `+${i}` : i));
};

export const surgeDomainsetToClashRuleset = (domainset: string[]) => {
  return domainset.map(i => (i[0] === '.' ? `DOMAIN-SUFFIX,${i.slice(1)}` : `DOMAIN,${i}`));
};
