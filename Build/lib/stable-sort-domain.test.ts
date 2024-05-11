// eslint-disable-next-line import-x/no-unresolved -- bun
import { describe, expect, it } from 'bun:test';

import { sortDomains } from './stable-sort-domain';

describe('sortDomains', () => {
  it('basic', () => {
    expect(sortDomains([
      '.s3-website.ap-northeast-3.amazonaws.com',
      '.s3.dualstack.ap-south-1.amazonaws.com',
      '.s3-website.af-south-1.amazonaws.com'
    ])).toStrictEqual([
      '.s3-website.af-south-1.amazonaws.com',
      '.s3.dualstack.ap-south-1.amazonaws.com',
      '.s3-website.ap-northeast-3.amazonaws.com'
    ]);

    expect(sortDomains([
      '.s3.dualstack.ap-south-1.amazonaws.com',
      '.s3-website.ap-northeast-3.amazonaws.com',
      '.s3-website.af-south-1.amazonaws.com'
    ])).toStrictEqual([
      '.s3-website.af-south-1.amazonaws.com',
      '.s3.dualstack.ap-south-1.amazonaws.com',
      '.s3-website.ap-northeast-3.amazonaws.com'
    ]);

    expect(sortDomains([
      '.s3-website-us-west-2.amazonaws.com',
      '.s3-1.amazonaws.com'
    ])).toStrictEqual([
      '.s3-1.amazonaws.com',
      '.s3-website-us-west-2.amazonaws.com'
    ]);

    expect(sortDomains([
      '.s3-1.amazonaws.com',
      '.s3-website-us-west-2.amazonaws.com'
    ])).toStrictEqual([
      '.s3-1.amazonaws.com',
      '.s3-website-us-west-2.amazonaws.com'
    ]);

    expect(
      sortDomains([
        '.s3-deprecated.us-west-2.amazonaws.com',
        '.s3-accesspoint.dualstack.us-west-2.amazonaws.com',
        '.s3.dualstack.us-west-2.amazonaws.com'
      ])
    ).toStrictEqual([
      '.s3.dualstack.us-west-2.amazonaws.com',
      '.s3-deprecated.us-west-2.amazonaws.com',
      '.s3-accesspoint.dualstack.us-west-2.amazonaws.com'
    ]);

    expect(
      sortDomains([
        '.s3-deprecated.us-west-2.amazonaws.com',
        '.s3-accesspoint.dualstack.us-west-2.amazonaws.com',
        '.s3.dualstack.us-west-2.amazonaws.com'
      ])
    ).toStrictEqual([
      '.s3.dualstack.us-west-2.amazonaws.com',
      '.s3-deprecated.us-west-2.amazonaws.com',
      '.s3-accesspoint.dualstack.us-west-2.amazonaws.com'
    ]);

    expect(
      sortDomains([
        '.ec2-25-58-215-234.us-east-2.compute.amazonaws.com',
        '.ec2-13-58-215-234.us-east-2.compute.amazonaws.com'
      ])
    ).toStrictEqual([
      '.ec2-13-58-215-234.us-east-2.compute.amazonaws.com',
      '.ec2-25-58-215-234.us-east-2.compute.amazonaws.com'
    ]);
  });
});
