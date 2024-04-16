// eslint-disable-next-line import-x/no-unresolved -- bun
import { describe, expect, it } from 'bun:test';
import createKeywordFilter from './aho-corasick';

describe('AhoCorasick', () => {
  it('basic', () => {
    const kwfilter = createKeywordFilter(['ap', 'an']);
    expect(kwfilter('bananan')).toBeTrue();
    expect(kwfilter('apple')).toBeTrue();
    expect(kwfilter('melon')).toBeFalse();
  });
});
