import * as tldts from 'tldts';
import { isProbablyIpv4 } from './is-fast-ip';
export const normalizeDomain = (domain: string) => {
  if (!domain) return null;
  if (isProbablyIpv4(domain)) return null;

  const parsed = tldts.parse(domain, { allowPrivateDomains: true, detectIp: false });
  // if (parsed.isIp) return null;
  if (!parsed.hostname) return null;
  if (!parsed.isIcann && !parsed.isPrivate) return null;

  let h = parsed.hostname;

  let sliceStart: number | undefined;
  let sliceEnd: number | undefined;

  if (h[0] === '.') sliceStart = 1;
  if (h.endsWith('.')) sliceEnd = -1;

  if (sliceStart !== undefined || sliceEnd !== undefined) {
    h = h.slice(sliceStart, sliceEnd);
  }

  if (h) return h;
  return null;
};
