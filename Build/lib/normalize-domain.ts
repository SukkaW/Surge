import { parse as tldtsParse } from 'tldts-experimental';
import { isProbablyIpv4 } from './is-fast-ip';
export const normalizeDomain = (domain: string) => {
  if (!domain) return null;
  if (isProbablyIpv4(domain)) return null;

  const parsed = tldtsParse(domain, { allowPrivateDomains: true, detectIp: false });
  // if (parsed.isIp) return null;
  if (!parsed.hostname) return null;
  // Private invalid domain (things like .tor, .dn42, etc)
  if (!parsed.isIcann && !parsed.isPrivate) return null;

  let h = parsed.hostname;

  let sliceStart: number | undefined;
  let sliceEnd: number | undefined;

  if (h[0] === '.') sliceStart = 1;
  if (h.endsWith('.')) sliceEnd = -1;

  if (sliceStart !== undefined || sliceEnd !== undefined) {
    h = h.slice(sliceStart, sliceEnd);
  }

  return h || null;
};
