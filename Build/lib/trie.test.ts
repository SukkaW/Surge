import { describe, it } from 'mocha';
import { expect } from 'expect';
import { HostnameSmolTrie, HostnameTrie } from './trie';

function createTrie<Meta = any>(from: string[] | Set<string> | null, smolTree: true): HostnameSmolTrie<Meta>;
function createTrie<Meta = any>(from?: string[] | Set<string> | null, smolTree?: false): HostnameTrie<Meta>;
function createTrie<_Meta = any>(from?: string[] | Set<string> | null, smolTree = true) {
  if (smolTree) {
    return new HostnameSmolTrie(from);
  }
  return new HostnameTrie(from);
};

// describe('hostname to tokens', () => {
//   it('should split hostname into tokens.', () => {
//     expect(hostnameToTokens('.blog.skk.moe')).toStrictEqual([
//       '.',
//       'blog',
//       '.',
//       'skk',
//       '.',
//       'moe'
//     ]);

//     expect(hostnameToTokens('blog.skk.moe')).toStrictEqual([
//       'blog',
//       '.',
//       'skk',
//       '.',
//       'moe'
//     ]);

//     expect(hostnameToTokens('skk.moe')).toStrictEqual([
//       'skk',
//       '.',
//       'moe'
//     ]);

//     expect(hostnameToTokens('moe')).toStrictEqual([
//       'moe'
//     ]);
//   });
// });

describe('Trie', () => {
  it('should be possible to add domains to a Trie.', () => {
    const trie = createTrie(null, false);

    trie.add('a.skk.moe');
    trie.add('skk.moe');
    trie.add('anotherskk.moe');

    expect(trie.size).toBe(3);

    expect(trie.has('a.skk.moe')).toBe(true);
    expect(trie.has('skk.moe')).toBe(true);
    expect(trie.has('anotherskk.moe')).toBe(true);
    expect(trie.has('example.com')).toBe(false);
    expect(trie.has('skk.mo')).toBe(false);
    expect(trie.has('another.skk.moe')).toBe(false);
  });

  it('adding the same item several times should not increase size.', () => {
    const trie = createTrie(null, false);

    trie.add('skk.moe');
    trie.add('blog.skk.moe');
    // eslint-disable-next-line sukka/no-element-overwrite -- deliberately do testing
    trie.add('skk.moe');

    expect(trie.size).toBe(2);
    expect(trie.has('skk.moe')).toBe(true);
  });

  it('should be possible to set the null sequence.', () => {
    const trie = createTrie(null, false);

    trie.add('');
    expect(trie.has('')).toBe(true);

    const trie2 = createTrie(null, true);
    trie2.add('');
    expect(trie2.has('')).toBe(true);
  });

  it('should be possible to delete items.', () => {
    const trie = createTrie(null, false);

    trie.add('skk.moe');
    trie.add('blog.skk.moe');
    trie.add('example.com');
    trie.add('moe.sb');

    expect(trie.delete('no-match.com')).toBe(false);
    expect(trie.delete('example.org')).toBe(false);

    expect(trie.delete('skk.moe')).toBe(true);
    expect(trie.has('skk.moe')).toBe(false);
    expect(trie.has('moe.sb')).toBe(true);

    expect(trie.size).toBe(3);

    expect(trie.delete('example.com')).toBe(true);
    expect(trie.size).toBe(2);
    expect(trie.delete('moe.sb')).toBe(true);
    expect(trie.size).toBe(1);
  });

  it('should be possible to check the existence of a sequence in the Trie.', () => {
    const trie = createTrie(null, true);

    trie.add('example.org.skk.moe');

    expect(trie.has('example.org.skk.moe')).toBe(true);
    expect(trie.has('skk.moe')).toBe(false);
    expect(trie.has('example.org')).toBe(false);
    expect(trie.has('')).toBe(false);
  });

  it('should be possible to retrieve items matching the given prefix.', () => {
    const trie = createTrie(null, false);

    trie.add('example.com');
    trie.add('blog.example.com');
    trie.add('cdn.example.com');
    trie.add('example.org');

    expect(trie.find('example.com')).toStrictEqual(['example.com', 'blog.example.com', 'cdn.example.com']);
    expect(trie.find('com')).toStrictEqual(['example.com', 'blog.example.com', 'cdn.example.com']);
    expect(trie.find('.example.com')).toStrictEqual(['blog.example.com', 'cdn.example.com']);
    expect(trie.find('org')).toStrictEqual(['example.org']);
    expect(trie.find('example.net')).toStrictEqual([]);
    expect(trie.dump()).toStrictEqual(['example.com', 'example.org', 'blog.example.com', 'cdn.example.com']);
  });

  it('should be possible to retrieve items matching the given prefix even with a smol trie', () => {
    const trie = createTrie(null, true);

    trie.add('.example.com');
    trie.add('example.com');
    trie.add('blog.example.com');
    trie.add('cdn.example.com');
    trie.add('example.org');

    expect(trie.find('example.com')).toStrictEqual(['.example.com']);
    expect(trie.find('com')).toStrictEqual(['.example.com']);
    expect(trie.find('.example.com')).toStrictEqual(['.example.com']);
    expect(trie.find('org')).toStrictEqual(['example.org']);
    expect(trie.find('example.net')).toStrictEqual([]);
    expect(trie.dump()).toStrictEqual(['.example.com', 'example.org']);
  });

  it('should be possible to create a trie from an arbitrary iterable.', () => {
    let trie = createTrie(['skk.moe', 'blog.skk.moe'], false);

    expect(trie.size).toBe(2);
    expect(trie.has('skk.moe')).toBe(true);

    trie = createTrie(new Set(['skk.moe', 'example.com']), false);
    expect(trie.size).toBe(2);
    expect(trie.has('skk.moe')).toBe(true);
  });
});

describe('surge domainset dedupe', () => {
  it('should not remove same entry', () => {
    const trie = createTrie(['.skk.moe', 'noc.one'], false);

    expect(trie.find('.skk.moe')).toStrictEqual(['.skk.moe']);
    expect(trie.find('noc.one')).toStrictEqual(['noc.one']);
  });

  it('should match subdomain - 1', () => {
    const trie = createTrie(['www.noc.one', 'www.sukkaw.com', 'blog.skk.moe', 'image.cdn.skk.moe', 'cdn.sukkaw.net'], false);

    expect(trie.find('.skk.moe')).toStrictEqual(['blog.skk.moe', 'image.cdn.skk.moe']);
    expect(trie.find('.sukkaw.com')).toStrictEqual(['www.sukkaw.com']);
  });

  it('should match subdomain - 2', () => {
    const trie = createTrie(['www.noc.one', 'www.sukkaw.com', '.skk.moe', 'blog.skk.moe', 'image.cdn.skk.moe', 'cdn.sukkaw.net'], false);

    expect(trie.find('.skk.moe')).toStrictEqual(['.skk.moe', 'blog.skk.moe', 'image.cdn.skk.moe']);
    expect(trie.find('.sukkaw.com')).toStrictEqual(['www.sukkaw.com']);
  });

  it('should not remove non-subdomain', () => {
    const trie = createTrie(['skk.moe', 'sukkaskk.moe'], false);
    expect(trie.find('.skk.moe')).toStrictEqual([]);
  });
});

describe('smol tree', () => {
  it('should init tree', () => {
    const trie = createTrie([
      'skk.moe',
      'anotherskk.moe',
      'blog.anotherskk.moe',
      'blog.skk.moe',
      '.cdn.local',
      'blog.img.skk.local',
      'img.skk.local'
    ], true);

    expect(trie.dump()).toStrictEqual([
      'skk.moe',
      'anotherskk.moe',
      '.cdn.local',
      'blog.skk.moe',
      'blog.anotherskk.moe',
      'img.skk.local',
      'blog.img.skk.local'
    ]);
  });

  it('should create simple tree - 1', () => {
    const trie = createTrie([
      '.skk.moe', 'blog.skk.moe', '.cdn.skk.moe', 'skk.moe',
      'www.noc.one', 'cdn.noc.one',
      '.blog.sub.example.com', 'sub.example.com', 'cdn.sub.example.com', '.sub.example.com'
    ], true);

    expect(trie.dump()).toStrictEqual([
      '.skk.moe',
      'www.noc.one',
      'cdn.noc.one',
      '.sub.example.com'
    ]);
  });

  it('should create simple tree - 2', () => {
    const trie = createTrie([
      '.skk.moe', 'blog.skk.moe', '.cdn.skk.moe', 'skk.moe'
    ], true);

    expect(trie.dump()).toStrictEqual([
      '.skk.moe'
    ]);
  });

  it('should create simple tree - 3', () => {
    const trie = createTrie([
      '.blog.sub.example.com', 'cdn.sub.example.com', '.sub.example.com'
    ], true);

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
    ], true);

    expect(trie.dump()).toStrictEqual([
      'commercial.shouji.360.cn',
      'cdn.creative.medialytics.com',
      'act.commercial.shouji.360.cn',
      'px.cdn.creative.medialytics.com'
    ]);
  });

  it('should dedupe subdomain properly', () => {
    const trie = createTrie([
      'skk.moe',
      'anotherskk.moe',
      'blog.anotherskk.moe',
      'blog.skk.moe'
    ], true);

    expect(trie.dump()).toStrictEqual([
      'skk.moe',
      'anotherskk.moe',
      'blog.skk.moe',
      'blog.anotherskk.moe'
    ]);
  });

  it('should effctly whitelist domains', () => {
    const trie = createTrie([
      'skk.moe',
      'anotherskk.moe',
      'blog.anotherskk.moe',
      'blog.skk.moe',
      '.cdn.local',
      'blog.img.skk.local',
      'img.skk.local'
    ], true);

    trie.whitelist('.skk.moe');

    expect(trie.dump()).toStrictEqual([
      'anotherskk.moe',
      '.cdn.local',
      'blog.anotherskk.moe',
      'img.skk.local',
      'blog.img.skk.local'
    ]);

    trie.whitelist('anotherskk.moe');
    expect(trie.dump()).toStrictEqual([
      '.cdn.local',
      'blog.anotherskk.moe',
      'img.skk.local',
      'blog.img.skk.local'
    ]);

    trie.add('anotherskk.moe');
    trie.whitelist('.anotherskk.moe');

    expect(trie.dump()).toStrictEqual([
      '.cdn.local',
      'img.skk.local',
      'blog.img.skk.local'
    ]);

    trie.whitelist('img.skk.local');
    expect(trie.dump()).toStrictEqual([
      '.cdn.local',
      'blog.img.skk.local'
    ]);

    trie.whitelist('cdn.local');
    expect(trie.dump()).toStrictEqual([
      'blog.img.skk.local'
    ]);

    trie.whitelist('.skk.local');
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
    ], true);

    expect(trie.dump()).toStrictEqual([
      '.t.co',
      '.skk.moe',
      'cdn.example.com', 'blog.cdn.example.com'
    ]);

    trie.whitelist('.t.co');
    expect(trie.dump()).toStrictEqual([
      '.skk.moe',
      'cdn.example.com', 'blog.cdn.example.com'
    ]);

    trie.whitelist('skk.moe');
    expect(trie.dump()).toStrictEqual(['cdn.example.com', 'blog.cdn.example.com']);

    trie.whitelist('cdn.example.com');
    expect(trie.dump()).toStrictEqual(['blog.cdn.example.com']);
  });
});
