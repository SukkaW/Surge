import { describe, it } from 'mocha';

import { calcDomainAbuseScore } from './get-phishing-domains';

describe('sortDomains', () => {
  it('nmdj.pl', () => {
    console.log(calcDomainAbuseScore('.booking-com'));
    console.log(calcDomainAbuseScore('plikgier'));
    console.log(calcDomainAbuseScore('www.addgumtree'));
    console.log(calcDomainAbuseScore('zrz'));
    console.log(calcDomainAbuseScore('z1'));
    console.log(calcDomainAbuseScore('accountsettingaddrecoverymanagesiteupdatebillingreview.village'));
    console.log(calcDomainAbuseScore('allegrolokalnie'));
  });

  it('zendesk.com', () => {
    console.log(calcDomainAbuseScore('binomo2'));
    console.log(calcDomainAbuseScore('www.binomo2'));
    console.log(calcDomainAbuseScore('store.binomo2'));
    console.log(calcDomainAbuseScore('gimp'));
    console.log(calcDomainAbuseScore('store.gimp'));
    console.log(calcDomainAbuseScore('www.gimp'));
  });

  it('digital-marketing-insights.icu', () => {
    console.log(calcDomainAbuseScore('ovusc7pijit9'));
  });
});
