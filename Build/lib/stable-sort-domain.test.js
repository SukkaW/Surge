const domainSorter = require('./stable-sort-domain');
const chai = require('chai');
const { describe, it } = require('mocha');

chai.should();

describe('stable-sort-domain', () => {
  it('.ks.cn, .tag.unclaimedproperty.ks.gov', () => {
    domainSorter('.ks.cn', '.tag.unclaimedproperty.ks.gov').should.eql(-1);
  });
});
