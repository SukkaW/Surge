import { createTrie } from './trie';
// eslint-disable-next-line import-x/no-unresolved -- fuck eslint-import
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

    console.log({ trie });

    expect(trie.find('roman')).toEqual(['roman', 'esqueroman', 'sesqueroman']);
    expect(trie.find('man')).toEqual(['roman', 'esqueroman', 'sesqueroman']);
    expect(trie.find('esqueroman')).toEqual(['esqueroman', 'sesqueroman']);
    expect(trie.find('eek')).toEqual(['greek']);
    expect(trie.find('hello')).toEqual([]);
    expect(trie.find('')).toEqual(['greek', 'roman', 'esqueroman', 'sesqueroman']);
  });

  it('should be possible to create a trie from an arbitrary iterable.', () => {
    const words = ['roman', 'esqueroman'];

    const trie = createTrie(words);

    expect(trie.size).toBe(2);
    expect(trie.has('roman')).toBe(true);
  });
});

describe.each([
  ['hostname mode off', false],
  ['hostname mode on', true]
])('surge domainset dedupe %s', (_, hostnameMode) => {
  it('should not remove same entry', () => {
    const trie = createTrie(['.skk.moe', 'noc.one'], hostnameMode);

    console.log(trie);

    expect(trie.find('.skk.moe')).toStrictEqual(['.skk.moe']);
    expect(trie.find('noc.one')).toStrictEqual(['noc.one']);
  });

  it('should match subdomain - 1', () => {
    const trie = createTrie(['www.noc.one', 'www.sukkaw.com', 'blog.skk.moe', 'image.cdn.skk.moe', 'cdn.sukkaw.net'], hostnameMode);

    console.log(trie);

    expect(trie.find('.skk.moe')).toStrictEqual(['image.cdn.skk.moe', 'blog.skk.moe']);
    expect(trie.find('.sukkaw.com')).toStrictEqual(['www.sukkaw.com']);
  });

  it('should match subdomain - 2', () => {
    const trie = createTrie(['www.noc.one', 'www.sukkaw.com', '.skk.moe', 'blog.skk.moe', 'image.cdn.skk.moe', 'cdn.sukkaw.net'], hostnameMode);

    console.log(trie);

    expect(trie.find('.skk.moe')).toStrictEqual(['.skk.moe', 'image.cdn.skk.moe', 'blog.skk.moe']);
    expect(trie.find('.sukkaw.com')).toStrictEqual(['www.sukkaw.com']);
  });

  it('should not remove non-subdomain', () => {
    const trie = createTrie(['skk.moe', 'sukkaskk.moe'], hostnameMode);
    expect(trie.find('.skk.moe')).toStrictEqual([]);
  });
});

describe('smol tree', () => {
  it('should create simple tree - 1', () => {
    const trie = createTrie([
      '.skk.moe', 'blog.skk.moe', '.cdn.skk.moe', 'skk.moe',
      'www.noc.one', 'cdn.noc.one',
      '.blog.sub.example.com', 'sub.example.com', 'cdn.sub.example.com', '.sub.example.com'
    ], true, true);

    expect(trie.dump()).toStrictEqual([
      '.sub.example.com',
      'cdn.noc.one', 'www.noc.one',
      '.skk.moe'
    ]);
  });

  it('should create simple tree - 2', () => {
    const trie = createTrie([
      '.skk.moe', 'blog.skk.moe', '.cdn.skk.moe', 'skk.moe'
    ], true, true);

    expect(trie.dump()).toStrictEqual([
      '.skk.moe'
    ]);
  });

  it('should create simple tree - 2', () => {
    const trie = createTrie([
      '.blog.sub.example.com', 'cdn.sub.example.com', '.sub.example.com'
    ], true, true);

    expect(trie.dump()).toStrictEqual([
      '.sub.example.com'
    ]);

    trie.add('.sub.example.com');
    expect(trie.dump()).toStrictEqual([
      '.sub.example.com'
    ]);
  });

  it('should create simple tree - 3', () => {
    const trie = createTrie([
      'commercial.shouji.360.cn',
      'act.commercial.shouji.360.cn',
      'cdn.creative.medialytics.com',
      'px.cdn.creative.medialytics.com'
    ], true, true);

    expect(trie.dump()).toStrictEqual([
      'cdn.creative.medialytics.com',
      'px.cdn.creative.medialytics.com',
      'commercial.shouji.360.cn',
      'act.commercial.shouji.360.cn'
    ]);
  });

  it('should dedupe subdomain properly', () => {
    const trie = createTrie([
      'skk.moe',
      'anotherskk.moe',
      'blog.anotherskk.moe',
      'blog.skk.moe'
    ], true, true);

    expect(trie.dump()).toStrictEqual([
      'anotherskk.moe',
      'blog.anotherskk.moe',
      'skk.moe',
      'blog.skk.moe'
    ]);
  });

  it('should efficiently whitelist domains', () => {
    const trie = createTrie([
      'skk.moe',
      'anotherskk.moe',
      'blog.anotherskk.moe',
      'blog.skk.moe'
    ], true, true);

    expect(trie.dump()).toStrictEqual([
      'anotherskk.moe',
      'blog.anotherskk.moe',
      'skk.moe',
      'blog.skk.moe'
    ]);

    trie.whitelist('.skk.moe');

    expect(trie.dump()).toStrictEqual([
      'anotherskk.moe',
      'blog.anotherskk.moe'
    ]);

    trie.whitelist('anotherskk.moe');

    expect(trie.dump()).toStrictEqual([
      'blog.anotherskk.moe'
    ]);

    trie.add('anotherskk.moe');
    trie.whitelist('.anotherskk.moe');

    expect(trie.dump()).toStrictEqual([]);
  });
});
