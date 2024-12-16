// https://github.com/remusao/tldts/issues/2121
// In short, single label domain suffix is ignored due to the size optimization, so no isIcann
// import tldts from 'tldts-experimental';
import tldts from 'tldts';
import { normalizeTldtsOpt } from '../constants/loose-tldts-opt';

type TldTsParsed = ReturnType<typeof tldts.parse>;

export function normalizeDomain(domain: string, parsed: TldTsParsed | null = null) {
  if (domain.length === 0) return null;

  parsed ??= tldts.parse(domain, normalizeTldtsOpt);

  if (parsed.isIp) return null;

  let h = parsed.hostname;
  if (h === null) return null;
  // Private invalid domain (things like .tor, .dn42, etc)
  if (!parsed.isIcann && !parsed.isPrivate) return null;

  let sliceStart = 0;
  let sliceEnd = 0;

  if (h[0] === '.') sliceStart = 1;
  // eslint-disable-next-line sukka/string/prefer-string-starts-ends-with -- performance
  if (h[h.length - 1] === '.') sliceEnd = -1;

  if (sliceStart !== 0 || sliceEnd !== 0) {
    h = h.slice(sliceStart, sliceEnd);
  }

  return h.length > 0 ? h : null;
}
