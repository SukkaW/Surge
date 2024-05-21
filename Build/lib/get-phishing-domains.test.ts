// eslint-disable-next-line import-x/no-unresolved -- bun
import { describe, expect, it } from 'bun:test';

import { calcDomainAbuseScore } from './get-phishing-domains';

describe('sortDomains', () => {
  it('nmdj.pl', () => {
    console.log(calcDomainAbuseScore('.01462ccca801fed55370d79231c876e5.nmdj.pl'));
  });
});
