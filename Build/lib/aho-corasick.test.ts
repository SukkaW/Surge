// eslint-disable-next-line import-x/no-unresolved -- bun
import { describe, expect, it } from 'bun:test';
import createKeywordFilter from './aho-corasick';

describe('AhoCorasick', () => {
  it('basic', () => {
    let kwfilter = createKeywordFilter(['ap', 'an']);
    expect(kwfilter('bananan')).toBeTrue();
    expect(kwfilter('apple')).toBeTrue();
    expect(kwfilter('melon')).toBeFalse();

    console.log(kwfilter);

    kwfilter = createKeywordFilter(['cdn', 'sukka']);
    expect(kwfilter('bananan')).toBeFalse();
    expect(kwfilter('apple')).toBeFalse();
    expect(kwfilter('melon')).toBeFalse();

    console.log(kwfilter);
    console.log(createKeywordFilter(['skk.moe', 'anotherskk', 'skk.com']));
  });
});
