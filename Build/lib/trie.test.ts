import { createTrie } from './trie';
// eslint-disable-next-line import/no-unresolved -- fuck eslint-import
import { describe, expect, it } from 'bun:test';

describe('Trie', () => {
  it('should be possible to add items to a Trie.', () => {
    const trie = createTrie();

    trie.add('sukka');
    trie.add('ukka');
    trie.add('akku');

    expect(trie.size).toBe(3);
    expect(trie.has('sukka')).toBeTrue();
    expect(trie.has('ukka')).toBeTrue();
    expect(trie.has('akku')).toBeTrue();
    expect(trie.has('noc')).toBeFalse();
    expect(trie.has('suk')).toBeFalse();
    expect(trie.has('sukkaw')).toBeFalse();
  });

  it('adding the same item several times should not increase size.', () => {
    const trie = createTrie();

    trie.add('rat');
    trie.add('erat');
    trie.add('rat');

    expect(trie.size).toBe(2);
    expect(trie.has('rat')).toBeTrue();
  });

  it('should be possible to set the null sequence.', () => {
    const trie = createTrie();

    trie.add('');
    expect(trie.has('')).toBeTrue();
  });

  it('should be possible to delete items.', () => {
    const trie = createTrie();

    trie.add('rat');
    trie.add('rate');
    trie.add('tar');

    expect(trie.delete('')).toBeFalse();
    expect(trie.delete('')).toBeFalse();
    expect(trie.delete('hello')).toBeFalse();

    expect(trie.delete('rat')).toBeTrue();
    expect(trie.has('rat')).toBeFalse();
    expect(trie.has('rate')).toBeTrue();

    expect(trie.size).toBe(2);

    expect(trie.delete('rate')).toBeTrue();
    expect(trie.size).toBe(1);
    expect(trie.delete('tar')).toBeTrue();
    expect(trie.size).toBe(0);
  });

  it('should be possible to check the existence of a sequence in the Trie.', () => {
    const trie = createTrie();

    trie.add('romanesque');

    expect(trie.has('romanesque')).toBe(true);
    expect(trie.has('roman')).toBe(false);
    expect(trie.has('')).toBe(false);
  });

  it('should be possible to retrieve items matching the given prefix.', () => {
    const trie = createTrie();

    trie.add('roman');
    trie.add('esqueroman');
    trie.add('sesqueroman');
    trie.add('greek');

    expect(trie.find('roman')).toEqual(['roman', 'esqueroman', 'sesqueroman']);
    expect(trie.find('man')).toEqual(['roman', 'esqueroman', 'sesqueroman']);
    expect(trie.find('esqueroman')).toEqual(['esqueroman', 'sesqueroman']);
    expect(trie.find('eek')).toEqual(['greek']);
    expect(trie.find('hello')).toEqual([]);
    expect(trie.find('')).toEqual(['greek', 'roman', 'esqueroman', 'sesqueroman']);
  });

  // it('should work with custom tokens.', () => {
  //   const trie = new Trie(Array);

  //   trie.add(['the', 'cat', 'eats', 'the', 'mouse']);
  //   trie.add(['the', 'mouse', 'eats', 'cheese']);
  //   trie.add(['hello', 'world']);

  //   assert.strictEqual(trie.size, 3);

  //   assert.strictEqual(trie.has(['the', 'mouse', 'eats', 'cheese']), true);
  //   assert.strictEqual(trie.has(['the', 'mouse', 'eats']), false);

  //   assert.strictEqual(trie.delete(['hello']), false);
  //   assert.strictEqual(trie.delete(['hello', 'world']), true);

  //   assert.strictEqual(trie.size, 2);
  // });

  // it('should be possible to iterate over the trie\'s prefixes.', () => {
  //   const trie = new Trie();

  //   trie.add('rat');
  //   trie.add('rate');

  //   let prefixes = take(trie.prefixes());

  //   assert.deepStrictEqual(prefixes, ['rat', 'rate']);

  //   trie.add('rater');
  //   trie.add('rates');

  //   prefixes = take(trie.keys('rate'));

  //   assert.deepStrictEqual(prefixes, ['rate', 'rates', 'rater']);
  // });

  // it('should be possible to iterate over the trie\'s prefixes using for...of.', () => {
  //   const trie = new Trie();

  //   trie.add('rat');
  //   trie.add('rate');

  //   const tests = [
  //     'rat',
  //     'rate'
  //   ];

  //   let i = 0;

  //   for (const prefix of trie)
  //     assert.deepStrictEqual(prefix, tests[i++]);
  // });

  it('should be possible to create a trie from an arbitrary iterable.', () => {
    const words = ['roman', 'esqueroman'];

    const trie = createTrie(words);

    expect(trie.size).toBe(2);
    expect(trie.has('roman')).toBe(true);
  });
});

describe('surge domainset dedupe', () => {
  it('should not remove same entry', () => {
    const trie = createTrie(['.skk.moe', 'noc.one']);

    expect(trie.find('.skk.moe')).toStrictEqual(['.skk.moe']);
    expect(trie.find('noc.one')).toStrictEqual(['noc.one']);
  });

  it('should remove subdomain', () => {
    const trie = createTrie(['www.noc.one', 'www.sukkaw.com', 'blog.skk.moe', 'image.cdn.skk.moe', 'cdn.sukkaw.net']);
    // trie.find('noc.one').toBe(['www.noc.one']);
    expect(trie.find('.skk.moe')).toStrictEqual(['image.cdn.skk.moe', 'blog.skk.moe']);
    // trie.find('sukkaw.net').toBe(['cdn.sukkaw.net']);
    expect(trie.find('.sukkaw.com')).toStrictEqual(['www.sukkaw.com']);
  });

  it('should not remove non-subdomain', () => {
    const trie = createTrie(['skk.moe', 'sukkaskk.moe']);
    expect(trie.find('.skk.moe')).toStrictEqual([]);
  });
});
