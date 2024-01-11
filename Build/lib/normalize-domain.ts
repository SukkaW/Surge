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

  let sliceStart = 0;
  let sliceEnd = h.length;

  if (h[0] === '.') sliceStart = 1;
  if (h.endsWith('.')) sliceEnd = -1;

  if (sliceStart !== 0 || sliceEnd !== h.length) {
    h = h.slice(sliceStart, sliceEnd);
  }

  if (h) return h;
  return null;
};
