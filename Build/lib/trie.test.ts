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

  it('should be possible to add domains to a Trie (hostname).', () => {
    const trie = createTrie(null, true);

    trie.add('a.skk.moe');
    trie.add('skk.moe');
    trie.add('anotherskk.moe');

    expect(trie.size).toBe(3);

    expect(trie.has('a.skk.moe')).toBeTrue();
    expect(trie.has('skk.moe')).toBeTrue();
    expect(trie.has('anotherskk.moe')).toBeTrue();
    expect(trie.has('example.com')).toBeFalse();
    expect(trie.has('skk.mo')).toBeFalse();
    expect(trie.has('another.skk.moe')).toBeFalse();
  });

  it('adding the same item several times should not increase size.', () => {
    const trie = createTrie();

    trie.add('rat');
    trie.add('erat');
    trie.add('rat');

    expect(trie.size).toBe(2);
    expect(trie.has('rat')).toBeTrue();
  });

  it('adding the same item several times should not increase size (hostname).', () => {
    const trie = createTrie(null, true);

    trie.add('skk.moe');
    trie.add('blog.skk.moe');
    trie.add('skk.moe');

    expect(trie.size).toBe(2);
    expect(trie.has('skk.moe')).toBeTrue();
  });

  it('should be possible to set the null sequence.', () => {
    let trie = createTrie();

    trie.add('');
    expect(trie.has('')).toBeTrue();

    trie = createTrie(null, true);
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

  it('should be possible to delete items (hostname).', () => {
    const trie = createTrie(null, true);

    trie.add('skk.moe');
    trie.add('example.com');
    trie.add('moe.sb');

    expect(trie.delete('')).toBeFalse();
    expect(trie.delete('')).toBeFalse();
    expect(trie.delete('example.org')).toBeFalse();

    expect(trie.delete('skk.moe')).toBeTrue();
    expect(trie.has('skk.moe')).toBeFalse();
    expect(trie.has('moe.sb')).toBeTrue();

    expect(trie.size).toBe(2);

    expect(trie.delete('example.com')).toBeTrue();
    expect(trie.size).toBe(1);
    expect(trie.delete('moe.sb')).toBeTrue();
    expect(trie.size).toBe(0);
  });

  it('should be possible to check the existence of a sequence in the Trie.', () => {
    const trie = createTrie();

    trie.add('romanesque');

    expect(trie.has('romanesque')).toBe(true);
    expect(trie.has('roman')).toBe(false);
    expect(trie.has('esque')).toBe(false);
    expect(trie.has('')).toBe(false);
  });

  it('should be possible to check the existence of a sequence in the Trie (hostname).', () => {
    const trie = createTrie(null, true);

    trie.add('example.org.skk.moe');

    expect(trie.has('example.org.skk.moe')).toBe(true);
    expect(trie.has('skk.moe')).toBe(false);
    expect(trie.has('example.org')).toBe(false);
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

  it('should be possible to retrieve items matching the given prefix (hostname).', () => {
    const trie = createTrie(null, true);

    trie.add('example.com');
    trie.add('blog.example.com');
    trie.add('cdn.example.com');
    trie.add('example.org');

    expect(trie.find('example.com')).toEqual(['example.com', 'cdn.example.com', 'blog.example.com']);
    expect(trie.find('com')).toEqual(['example.com', 'cdn.example.com', 'blog.example.com']);
    expect(trie.find('.example.com')).toEqual(['cdn.example.com', 'blog.example.com']);
    expect(trie.find('org')).toEqual(['example.org']);
    expect(trie.find('example.net')).toEqual([]);
    expect(trie.find('')).toEqual(['example.org', 'example.com', 'cdn.example.com', 'blog.example.com']);
  });

  it('should be possible to create a trie from an arbitrary iterable.', () => {
    let trie = createTrie(['roman', 'esqueroman']);

    expect(trie.size).toBe(2);
    expect(trie.has('roman')).toBe(true);

    trie = createTrie(new Set(['skk.moe', 'example.com']), true);
    expect(trie.size).toBe(2);
    expect(trie.has('skk.moe')).toBe(true);
  });
});

describe.each([
  ['hostname mode off', false],
  ['hostname mode on', true]
])('surge domainset dedupe %s', (_, hostnameMode) => {
  it('should not remove same entry', () => {
    const trie = createTrie(['.skk.moe', 'noc.one'], hostnameMode);

    expect(trie.find('.skk.moe')).toStrictEqual(['.skk.moe']);
    expect(trie.find('noc.one')).toStrictEqual(['noc.one']);
  });

  it('should match subdomain - 1', () => {
    const trie = createTrie(['www.noc.one', 'www.sukkaw.com', 'blog.skk.moe', 'image.cdn.skk.moe', 'cdn.sukkaw.net'], hostnameMode);

    expect(trie.find('.skk.moe')).toStrictEqual(['image.cdn.skk.moe', 'blog.skk.moe']);
    expect(trie.find('.sukkaw.com')).toStrictEqual(['www.sukkaw.com']);
  });

  it('should match subdomain - 2', () => {
    const trie = createTrie(['www.noc.one', 'www.sukkaw.com', '.skk.moe', 'blog.skk.moe', 'image.cdn.skk.moe', 'cdn.sukkaw.net'], hostnameMode);

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

  it('should whitelist trie correctly', () => {
    const trie = createTrie([
      '.t.co',
      't.co',
      'example.t.co',
      '.skk.moe',
      'blog.cdn.example.com',
      'cdn.example.com'
    ], true, true);

    expect(trie.dump()).toStrictEqual([
      'cdn.example.com', 'blog.cdn.example.com',
      '.skk.moe',
      '.t.co'
    ]);

    trie.whitelist('.t.co');
    expect(trie.dump()).toStrictEqual([
      'cdn.example.com', 'blog.cdn.example.com',
      '.skk.moe'
    ]);

    trie.whitelist('skk.moe');
    expect(trie.dump()).toStrictEqual(['cdn.example.com', 'blog.cdn.example.com']);

    trie.whitelist('cdn.example.com');
    expect(trie.dump()).toStrictEqual(['blog.cdn.example.com']);
  });
});
