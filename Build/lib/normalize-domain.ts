// https://github.com/remusao/tldts/issues/2121
// In short, single label domain suffix is ignored due to the size optimization, so no isIcann
// import tldts from 'tldts-experimental';
import tldts from 'tldts';
import { normalizeTldtsOpt } from '../constants/loose-tldts-opt';
import { isProbablyIpv4, isProbablyIpv6 } from 'foxts/is-probably-ip';

type TldTsParsed = ReturnType<typeof tldts.parse>;

/**
 * Skipped the input non-empty check, the `domain` should not be empty.
 */
export function fastNormalizeDomain(domain: string, parsed: TldTsParsed | null = null) {
  // We don't want tldts to call its own "extractHostname" on ip, bail out ip first.
  // Now ip has been bailed out, we can safely set normalizeTldtsOpt.detectIp to false.
  if (isProbablyIpv4(domain) || isProbablyIpv6(domain)) {
    return null;
  }

  parsed ??= tldts.parse(domain, normalizeTldtsOpt);
  // Private invalid domain (things like .tor, .dn42, etc)
  if (!parsed.isIcann && !parsed.isPrivate) return null;

  return parsed.hostname;
}

export function fastNormalizeDomainIgnoreWww(domain: string, parsed: TldTsParsed | null = null) {
  // We don't want tldts to call its own "extractHostname" on ip, bail out ip first.
  // Now ip has been bailed out, we can safely set normalizeTldtsOpt.detectIp to false.
  if (isProbablyIpv4(domain) || isProbablyIpv6(domain)) {
    return null;
  }

  parsed ??= tldts.parse(domain, normalizeTldtsOpt);

  // Private invalid domain (things like .tor, .dn42, etc)
  if (!parsed.isIcann && !parsed.isPrivate) return null;

  if (parsed.subdomain === 'www') {
    return parsed.domain;
  }
  return parsed.hostname;
}

export function normalizeDomain(domain: string, parsed: TldTsParsed | null = null) {
  if (domain.length === 0) return null;

  if (isProbablyIpv4(domain) || isProbablyIpv6(domain)) {
    return null;
  }

  parsed ??= tldts.parse(domain, normalizeTldtsOpt);
  // Private invalid domain (things like .tor, .dn42, etc)
  if (!parsed.isIcann && !parsed.isPrivate) return null;

  // const h = parsed.hostname;
  // if (h === null) return null;

  return parsed.hostname;
}
