require('chai').should();

const createTrie = require('./trie');
const assert = require('assert');
const { describe, it } = require('mocha');

describe('Trie', () => {
  it('should be possible to add items to a Trie.', () => {
    const trie = createTrie();

    trie.add('sukka');
    trie.add('ukka');
    trie.add('akku');

    trie.size.should.eq(3);
    trie.has('sukka').should.eq(true);
    trie.has('ukka').should.eq(true);
    trie.has('akku').should.eq(true);
    trie.has('noc').should.eq(false);
    trie.has('suk').should.eq(false);
    trie.has('sukkaw').should.eq(false);
  });

  it('adding the same item several times should not increase size.', () => {
    const trie = createTrie();

    trie.add('rat');
    trie.add('erat');
    trie.add('rat');

    assert.strictEqual(trie.size, 2);
    assert.strictEqual(trie.has('rat'), true);
  });

  it('should be possible to set the null sequence.', () => {
    const trie = createTrie();

    trie.add('');
    trie.has('').should.eq(true);
  });

  it('should be possible to delete items.', () => {
    const trie = createTrie();

    trie.add('rat');
    trie.add('rate');
    trie.add('tar');

    assert.strictEqual(trie.delete(''), false);
    trie.delete('').should.eq(false);
    trie.delete('hello').should.eq(false);

    trie.delete('rat').should.eq(true);
    trie.has('rat').should.eq(false);
    trie.has('rate').should.eq(true);

    trie.size.should.eq(2);

    assert.strictEqual(trie.delete('rate'), true);
    assert.strictEqual(trie.size, 1);
    assert.strictEqual(trie.delete('tar'), true);
    assert.strictEqual(trie.size, 0);
  });

  it('should be possible to check the existence of a sequence in the Trie.', () => {
    const trie = createTrie();

    trie.add('romanesque');

    assert.strictEqual(trie.has('romanesque'), true);
    assert.strictEqual(trie.has('roman'), false);
    assert.strictEqual(trie.has(''), false);
  });

  it('should be possible to retrieve items matching the given prefix.', () => {
    const trie = createTrie();

    trie.add('roman');
    trie.add('esqueroman');
    trie.add('sesqueroman');
    trie.add('greek');

    assert.deepStrictEqual(trie.find('roman'), ['roman', 'esqueroman', 'sesqueroman']);
    assert.deepStrictEqual(trie.find('man'), ['roman', 'esqueroman', 'sesqueroman']);
    assert.deepStrictEqual(trie.find('esqueroman'), ['esqueroman', 'sesqueroman']);
    assert.deepStrictEqual(trie.find('eek'), ['greek']);
    assert.deepStrictEqual(trie.find('hello'), []);
    assert.deepStrictEqual(trie.find(''), ['greek', 'roman', 'esqueroman', 'sesqueroman']);
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

    assert.strictEqual(trie.size, 2);
    assert.deepStrictEqual(trie.has('roman'), true);
  });
});

describe('surge domainset dedupe', () => {
  it('should not remove same entry', () => {
    const trie = createTrie(['.skk.moe', 'noc.one']);

    trie.find('.skk.moe').should.eql(['.skk.moe']);
    trie.find('noc.one').should.eql(['noc.one']);
  });

  it('should remove subdomain', () => {
    const trie = createTrie(['www.noc.one', 'www.sukkaw.com', 'blog.skk.moe', 'image.cdn.skk.moe', 'cdn.sukkaw.net']);
    // trie.find('noc.one').should.eql(['www.noc.one']);
    trie.find('.skk.moe').should.eql(['image.cdn.skk.moe', 'blog.skk.moe']);
    // trie.find('sukkaw.net').should.eql(['cdn.sukkaw.net']);
    trie.find('.sukkaw.com').should.eql(['www.sukkaw.com']);
  });

  it('should not remove non-subdomain', () => {
    const trie = createTrie(['skk.moe', 'sukkaskk.moe']);
    trie.find('.skk.moe').should.eql([]);
  });
});
