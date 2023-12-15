import * as tldts from './cached-tld-parse';
import { isProbablyIpv4 } from './is-fast-ip';
export const normalizeDomain = (domain: string) => {
  if (!domain) return null;
  if (isProbablyIpv4(domain)) return null;

  const parsed = tldts.parse2(domain);
  if (parsed.isIp) return null;
  if (!parsed.isIcann && !parsed.isPrivate) return null;

  const h = parsed.hostname;
  if (!h) return null;

  return h[0] === '.' ? h.slice(1) : h;
};
