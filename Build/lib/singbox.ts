import picocolors from 'picocolors';
import { domainWildCardToRegex } from './misc';
import { isProbablyIpv4, isProbablyIpv6 } from './is-fast-ip';

const unsupported = Symbol('unsupported');

const toNumberTuple = <T extends string>(key: T, value: string): [T, number] | null => {
  const tmp = Number(value);
  return Number.isNaN(tmp) ? null : [key, tmp];
};

// https://sing-box.sagernet.org/configuration/rule-set/source-format/
const PROCESSOR: Record<string, ((raw: string, type: string, value: string) => [key: keyof SingboxHeadlessRule, value: Required<SingboxHeadlessRule>[keyof SingboxHeadlessRule][number]] | null) | typeof unsupported> = {
  DOMAIN: (_1, _2, value) => ['domain', value],
  'DOMAIN-SUFFIX': (_1, _2, value) => ['domain_suffix', value],
  'DOMAIN-KEYWORD': (_1, _2, value) => ['domain_keyword', value],
  'DOMAIN-WILDCARD': (_1, _2, value) => ['domain_regex', domainWildCardToRegex(value)],
  GEOIP: unsupported,
  'IP-CIDR': (_1, _2, value) => ['ip_cidr', value.endsWith(',no-resolve') ? value.slice(0, -11) : value],
  'IP-CIDR6': (_1, _2, value) => ['ip_cidr', value.endsWith(',no-resolve') ? value.slice(0, -11) : value],
  'IP-ASN': unsupported,
  'SRC-IP': (_1, _2, value) => {
    if (value.includes('/')) {
      return ['source_ip_cidr', value];
    }
    if (isProbablyIpv4(value)) {
      return ['source_ip_cidr', value + '/32'];
    }
    if (isProbablyIpv6(value)) {
      return ['source_ip_cidr', value + '/128'];
    }
    return null;
  },
  'SRC-IP-CIDR': (_1, _2, value) => ['source_ip_cidr', value.endsWith(',no-resolve') ? value.slice(0, -11) : value],
  'SRC-PORT': (_1, _2, value) => toNumberTuple('source_port', value),
  'DST-PORT': (_1, _2, value) => toNumberTuple('port', value),
  'PROCESS-NAME': (_1, _2, value) => ((value.includes('/') || value.includes('\\')) ? ['process_path', value] : ['process_name', value]),
  // 'PROCESS-PATH': (_1, _2, value) => ['process_path', value],
  'DEST-PORT': (_1, _2, value) => toNumberTuple('port', value),
  'IN-PORT': (_1, _2, value) => toNumberTuple('source_port', value),
  'URL-REGEX': unsupported,
  'USER-AGENT': unsupported
};

interface SingboxHeadlessRule {
  domain?: string[],
  domain_suffix?: string[],
  domain_keyword?: string[],
  domain_regex?: string[],
  source_ip_cidr?: string[],
  ip_cidr?: string[],
  source_port?: number[],
  source_port_range?: string[],
  port?: number[],
  port_range?: string[],
  process_name?: string[],
  process_path?: string[]
}

interface SingboxSourceFormat {
  version: 2 | number & {},
  rules: SingboxHeadlessRule[]
}

export const surgeRulesetToSingbox = (rules: string[] | Set<string>): SingboxSourceFormat => {
  const rule: SingboxHeadlessRule = Array.from(rules).reduce<SingboxHeadlessRule>((acc, cur) => {
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
        const r = proc(cur, type, value);
        if (r) {
          const [k, v] = r;
          acc[k] ||= [];
          (acc[k] as any).push(v);
        }
      }
    } else {
      console.log(picocolors.yellow(`[sing-box] unknown rule type: ${type}`), cur);
    }
    return acc;
  }, {});

  return {
    version: 2,
    rules: [rule]
  };
};

export const surgeDomainsetToSingbox = (domainset: string[]) => {
  const rule = domainset.reduce((acc, cur) => {
    if (cur[0] === '.') {
      acc.domain_suffix.push(cur.slice(1));
    } else {
      acc.domain.push(cur);
    }
    return acc;
  }, { domain: [] as string[], domain_suffix: [] as string[] } satisfies SingboxHeadlessRule);

  return {
    version: 2,
    rules: [rule]
  };
};

export const ipCidrListToSingbox = (ipCidrList: string[]): SingboxSourceFormat => {
  return {
    version: 2,
    rules: [{
      ip_cidr: ipCidrList
    }]
  };
};
