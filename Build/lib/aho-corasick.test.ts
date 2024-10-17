import { describe, it } from 'mocha';
import { expect } from 'expect';
import createKeywordFilter from './aho-corasick';

describe('AhoCorasick', () => {
  it('basic', () => {
    let kwfilter = createKeywordFilter(['ap', 'an']);
    expect(kwfilter('bananan')).toBe(true);
    expect(kwfilter('apple')).toBe(true);
    expect(kwfilter('melon')).toBe(false);

    kwfilter = createKeywordFilter(['cdn', 'sukka']);
    expect(kwfilter('bananan')).toBe(false);
    expect(kwfilter('apple')).toBe(false);
    expect(kwfilter('melon')).toBe(false);
  });
});
