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
});
