import { domainWildCardToRegex, identity } from './misc';
import { isProbablyIpv4, isProbablyIpv6 } from './is-fast-ip';

const unsupported = Symbol('unsupported');

// https://dreamacro.github.io/clash/configuration/rules.html
export const PROCESSOR: Record<string, ((raw: string, type: string, value: string) => string) | typeof unsupported> = {
  DOMAIN: identity,
  'DOMAIN-SUFFIX': identity,
  'DOMAIN-KEYWORD': identity,
  'DOMAIN-WILDCARD': (_raw, _type, value) => `DOMAIN-REGEX,${domainWildCardToRegex(value)}`,
  GEOIP: identity,
  'IP-CIDR': identity,
  'IP-CIDR6': identity,
  'IP-ASN': identity,
  'SRC-IP': (_raw, _type, value) => {
    if (value.includes('/')) {
      return `SRC-IP-CIDR,${value}`;
    }
    if (isProbablyIpv4(value)) {
      return `SRC-IP-CIDR,${value}/32`;
    }
    if (isProbablyIpv6(value)) {
      return `SRC-IP-CIDR6,${value}/128`;
    }
    return '';
  },
  'SRC-IP-CIDR': identity,
  'SRC-PORT': identity,
  'DST-PORT': identity,
  'PROCESS-NAME': (_raw, _type, value) => ((value.includes('/') || value.includes('\\')) ? `PROCESS-PATH,${value}` : `PROCESS-NAME,${value}`),
  'DEST-PORT': (_raw, _type, value) => `DST-PORT,${value}`,
  'IN-PORT': (_raw, _type, value) => `SRC-PORT,${value}`,
  'URL-REGEX': unsupported,
  'USER-AGENT': unsupported
};
