// https://github.com/remusao/tldts/issues/2121
// In short, single label domain suffix is ignored due to the size optimization, so no isIcann
// import tldts from 'tldts-experimental';
import tldts from 'tldts';
import { normalizeTldtsOpt } from '../constants/loose-tldts-opt';

type TldTsParsed = ReturnType<typeof tldts.parse>;

/**
 * Skipped the input non-empty check, the `domain` should not be empty.
 */
export function fastNormalizeDomain(domain: string, parsed: TldTsParsed = tldts.parse(domain, normalizeTldtsOpt)) {
  if (parsed.isIp) return null;
  // Private invalid domain (things like .tor, .dn42, etc)
  if (!parsed.isIcann && !parsed.isPrivate) return null;

  return parsed.hostname;
}

export function normalizeDomain(domain: string, parsed: TldTsParsed | null = null) {
  if (domain.length === 0) return null;

  parsed ??= tldts.parse(domain, normalizeTldtsOpt);

  if (parsed.isIp) return null;
  // Private invalid domain (things like .tor, .dn42, etc)
  if (!parsed.isIcann && !parsed.isPrivate) return null;

  // const h = parsed.hostname;
  // if (h === null) return null;

  return parsed.hostname;
}
