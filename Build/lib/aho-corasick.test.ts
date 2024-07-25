import { describe, it } from 'mocha';
import { expect } from 'chai';
import createKeywordFilter from './aho-corasick';

describe('AhoCorasick', () => {
  it('basic', () => {
    let kwfilter = createKeywordFilter(['ap', 'an']);
    expect(kwfilter('bananan')).to.equal(true);
    expect(kwfilter('apple')).to.equal(true);
    expect(kwfilter('melon')).to.equal(false);

    kwfilter = createKeywordFilter(['cdn', 'sukka']);
    expect(kwfilter('bananan')).to.equal(false);
    expect(kwfilter('apple')).to.equal(false);
    expect(kwfilter('melon')).to.equal(false);
  });
});
