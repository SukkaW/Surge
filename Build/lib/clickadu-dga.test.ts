import { describe, it } from 'mocha';
import { expect } from 'earl';

import { getClickaduDgaDomain, getClickaduDgaDomains } from './clickadu-dga';

const at = (iso: string) => Date.parse(iso);

describe('clickadu-dga', () => {
  it('reproduces the sample domain from AdGuard Base filter', () => {
    expect(getClickaduDgaDomain(at('2026-03-07T12:00:00Z'), -540)).toEqual('ztagfuazw.in');
    expect(getClickaduDgaDomain(at('2026-03-07T17:59:59Z'), -180)).toEqual('ztagfuazw.in');
  });

  it('splits visitors into three timezone groups', () => {
    const t = at('2026-11-06T00:00:00Z');
    expect(getClickaduDgaDomain(t, 0)).toEqual('amxxream.in');
    expect(getClickaduDgaDomain(t, -480)).toEqual('amxxream.in');
    expect(getClickaduDgaDomain(t, 300)).toEqual('onpaslsre.in');
    expect(getClickaduDgaDomain(t, -180)).toEqual('jrulwutpaf.in');
    expect(getClickaduDgaDomain(t, -540)).toEqual('jrulwutpaf.in');
  });

  it('rotates every 6 hours', () => {
    expect(getClickaduDgaDomain(at('2026-11-06T05:59:59Z'), 0)).toEqual('amxxream.in');
    expect(getClickaduDgaDomain(at('2026-11-06T06:00:00Z'), 0)).toEqual('zuzaghbkajav.in');
  });

  it('uses .com between 2026-07-06 and 2026-07-20', () => {
    expect(getClickaduDgaDomain(at('2026-07-10T00:00:00Z'), 0)).toMatchRegex(/^[a-z]{8,12}\.com$/);
    expect(getClickaduDgaDomain(at('2026-07-20T00:00:00Z'), 0)).toMatchRegex(/^[a-z]{8,12}\.in$/);
  });

  it('freezes after the loader time cap', () => {
    const last = getClickaduDgaDomain(at('2026-12-18T18:00:00Z'), 0);
    expect(getClickaduDgaDomain(at('2027-03-01T00:00:00Z'), 0)).toEqual(last);
  });

  it('rejects timestamps before the implemented branch', () => {
    expect(() => getClickaduDgaDomain(at('2026-01-01T00:00:00Z'), 0)).toThrow(RangeError);
  });

  it('lists every domain in a time window', () => {
    const domains = getClickaduDgaDomains(at('2026-11-06T00:00:00Z'), at('2026-11-06T06:00:00Z'));
    expect(domains.sort()).toEqual([
      'wigtuxopb.in', 'jpedfaatfb.in', 'oswazxgraza.in',
      'amxxream.in', 'onpaslsre.in', 'jrulwutpaf.in',
      'zuzaghbkajav.in', 'lmushaxu.in', 'khaguxovt.in'
    ].sort());
  });
});
