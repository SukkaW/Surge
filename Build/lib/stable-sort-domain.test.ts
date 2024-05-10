// eslint-disable-next-line import-x/no-unresolved -- bun
import { describe, expect, it } from 'bun:test';

import { sortDomains } from './stable-sort-domain';
import { getGorhillPublicSuffixPromise } from './get-gorhill-publicsuffix';

describe('sortDomains', () => {
  it('basic', async () => {
    const gorhill = await getGorhillPublicSuffixPromise();

    expect(
      sortDomains([
        '.s3-website.ap-northeast-3.amazonaws.com',
        '.s3.dualstack.ap-south-1.amazonaws.com',
        '.s3-website.af-south-1.amazonaws.com'
      ], gorhill)
    ).toStrictEqual(
      sortDomains([
        '.s3.dualstack.ap-south-1.amazonaws.com',
        '.s3-website.ap-northeast-3.amazonaws.com',
        '.s3-website.af-south-1.amazonaws.com'
      ], gorhill)
    );

    expect(
      sortDomains([
        '.s3-website-us-west-2.amazonaws.com',
        '.s3-1.amazonaws.com'
      ], gorhill)
    ).toStrictEqual(
      sortDomains([
        '.s3-1.amazonaws.com',
        '.s3-website-us-west-2.amazonaws.com'
      ], gorhill)
    );

    expect(
      sortDomains([
        '.s3-deprecated.us-west-2.amazonaws.com',
        '.s3-accesspoint.dualstack.us-west-2.amazonaws.com',
        '.s3.dualstack.us-west-2.amazonaws.com'
      ], gorhill)
    ).toStrictEqual(
      sortDomains([
        '.s3-accesspoint.dualstack.us-west-2.amazonaws.com',
        '.s3.dualstack.us-west-2.amazonaws.com',
        '.s3-deprecated.us-west-2.amazonaws.com'
      ], gorhill)
    );
  });
});
