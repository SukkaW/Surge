import * as tldts from './cached-tld-parse';
import { isProbablyIpv4 } from './is-fast-ip';
export const normalizeDomain = (domain: string) => {
  if (!domain) return null;
  if (isProbablyIpv4(domain)) return null;

  const parsed = tldts.parse2(domain);
  // if (parsed.isIp) return null;
  if (!parsed.hostname) return null;
  if (!parsed.isIcann && !parsed.isPrivate) return null;

  let h = parsed.hostname;
  if (h[0] === '.') h = h.slice(1);
  if (h.endsWith('.')) h = h.slice(0, -1);

  if (h) return h;
  return null;
};
