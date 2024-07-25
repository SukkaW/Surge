import { describe, it } from 'mocha';
import { expect } from 'chai';
import { sortDomains } from './stable-sort-domain';

describe('sortDomains', () => {
  it('basic', () => {
    expect(sortDomains([
      '.s3-website.ap-northeast-3.amazonaws.com',
      '.s3.dualstack.ap-south-1.amazonaws.com',
      '.s3-website.af-south-1.amazonaws.com'
    ])).to.deep.equal([
      '.s3-website.af-south-1.amazonaws.com',
      '.s3.dualstack.ap-south-1.amazonaws.com',
      '.s3-website.ap-northeast-3.amazonaws.com'
    ]);

    expect(sortDomains([
      '.s3.dualstack.ap-south-1.amazonaws.com',
      '.s3-website.ap-northeast-3.amazonaws.com',
      '.s3-website.af-south-1.amazonaws.com'
    ])).to.deep.equal([
      '.s3-website.af-south-1.amazonaws.com',
      '.s3.dualstack.ap-south-1.amazonaws.com',
      '.s3-website.ap-northeast-3.amazonaws.com'
    ]);

    expect(sortDomains([
      '.s3-website-us-west-2.amazonaws.com',
      '.s3-1.amazonaws.com'
    ])).to.deep.equal([
      '.s3-1.amazonaws.com',
      '.s3-website-us-west-2.amazonaws.com'
    ]);

    expect(sortDomains([
      '.s3-1.amazonaws.com',
      '.s3-website-us-west-2.amazonaws.com'
    ])).to.deep.equal([
      '.s3-1.amazonaws.com',
      '.s3-website-us-west-2.amazonaws.com'
    ]);

    expect(
      sortDomains([
        '.s3-deprecated.us-west-2.amazonaws.com',
        '.s3-accesspoint.dualstack.us-west-2.amazonaws.com',
        '.s3.dualstack.us-west-2.amazonaws.com'
      ])
    ).to.deep.equal([
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
    ).to.deep.equal([
      '.s3.dualstack.us-west-2.amazonaws.com',
      '.s3-deprecated.us-west-2.amazonaws.com',
      '.s3-accesspoint.dualstack.us-west-2.amazonaws.com'
    ]);

    expect(
      sortDomains([
        '.ec2-25-58-215-234.us-east-2.compute.amazonaws.com',
        '.ec2-13-58-215-234.us-east-2.compute.amazonaws.com'
      ])
    ).to.deep.equal([
      '.ec2-13-58-215-234.us-east-2.compute.amazonaws.com',
      '.ec2-25-58-215-234.us-east-2.compute.amazonaws.com'
    ]);
  });

  it('samsung test case', () => {
    expect(sortDomains([
      '.notice.samsungcloudsolution.com',
      'samsungqbe.com',
      'samsungcloudsolution.com'
    ])).to.deep.equal([
      'samsungqbe.com',
      'samsungcloudsolution.com',
      '.notice.samsungcloudsolution.com'
    ]);

    expect(
      sortDomains([
        '.notice.samsungcloudsolution.com',
        '.vdterms.samsungcloudsolution.com',
        '.gamespromotion.samsungcloudsolution.com',
        '.samsunggiveaways.com',
        '.gld.samsungosp.com',
        'samsungqbe.com',
        'samsungcloudsolution.com',
        '.sas.samsungcloudsolution.com',
        '.prov.samsungcloudsolution.com',
        '.musicid.samsungcloudsolution.com',
        '.amauthprd.samsungcloudsolution.com',
        '.noticecdn.samsungcloudsolution.com',
        '.abtauthprd.samsungcloudsolution.com',
        '.noticefile.samsungcloudsolution.com',
        '.prderrordumphsm.samsungcloudsolution.com',
        'samsungcloudsolution.net',
        '.cdn.samsungcloudsolution.net',
        '.lcprd1.samsungcloudsolution.net',
        '.lcprd2.samsungcloudsolution.net',
        '.samsungelectronics.com',
        '.analytics-api.samsunghealthcn.com',
        '.tracking.samsungknox.com',
        '.analytics.samsungknox.com',
        '.metrics.samsunglife.com',
        '.smetrics.samsunglife.com',
        '.nmetrics.samsungmobile.com',
        '.rwww.samsungotn.net',
        '.samsungpoland.com.pl'
      ])
    ).to.deep.equal([
      '.gld.samsungosp.com',
      '.rwww.samsungotn.net',
      'samsungqbe.com',
      '.tracking.samsungknox.com',
      '.analytics.samsungknox.com',
      '.metrics.samsunglife.com',
      '.smetrics.samsunglife.com',
      '.nmetrics.samsungmobile.com',
      '.analytics-api.samsunghealthcn.com',
      '.samsunggiveaways.com',
      '.samsungpoland.com.pl',
      '.samsungelectronics.com',
      'samsungcloudsolution.com',
      '.sas.samsungcloudsolution.com',
      '.prov.samsungcloudsolution.com',
      '.notice.samsungcloudsolution.com',
      '.musicid.samsungcloudsolution.com',
      '.vdterms.samsungcloudsolution.com',
      '.amauthprd.samsungcloudsolution.com',
      '.noticecdn.samsungcloudsolution.com',
      '.abtauthprd.samsungcloudsolution.com',
      '.noticefile.samsungcloudsolution.com',
      '.gamespromotion.samsungcloudsolution.com',
      '.prderrordumphsm.samsungcloudsolution.com',
      'samsungcloudsolution.net',
      '.cdn.samsungcloudsolution.net',
      '.lcprd1.samsungcloudsolution.net',
      '.lcprd2.samsungcloudsolution.net'
    ]);
  });
});
