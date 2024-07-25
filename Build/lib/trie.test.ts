import { createTrie } from './trie';
import { describe, it } from 'mocha';
import { expect } from 'chai';

describe('Trie', () => {
  it('should be possible to add items to a Trie.', () => {
    const trie = createTrie();

    trie.add('sukka');
    trie.add('ukka');
    trie.add('akku');

    expect(trie.size).to.equal(3);

    expect(trie.has('sukka')).to.equal(true);
    expect(trie.has('ukka')).to.equal(true);
    expect(trie.has('akku')).to.equal(true);
    expect(trie.has('noc')).to.equal(false);
    expect(trie.has('suk')).to.equal(false);
    expect(trie.has('sukkaw')).to.equal(false);
  });

  it('should be possible to add domains to a Trie (hostname).', () => {
    const trie = createTrie(null, true);

    trie.add('a.skk.moe');
    trie.add('skk.moe');
    trie.add('anotherskk.moe');

    expect(trie.size).to.equal(3);

    expect(trie.has('a.skk.moe')).to.equal(true);
    expect(trie.has('skk.moe')).to.equal(true);
    expect(trie.has('anotherskk.moe')).to.equal(true);
    expect(trie.has('example.com')).to.equal(false);
    expect(trie.has('skk.mo')).to.equal(false);
    expect(trie.has('another.skk.moe')).to.equal(false);
  });

  it('adding the same item several times should not increase size.', () => {
    const trie = createTrie();

    trie.add('rat');
    trie.add('erat');
    trie.add('rat');

    expect(trie.size).to.equal(2);
    expect(trie.has('rat')).to.equal(true);
  });

  it('adding the same item several times should not increase size (hostname).', () => {
    const trie = createTrie(null, true);

    trie.add('skk.moe');
    trie.add('blog.skk.moe');
    trie.add('skk.moe');

    expect(trie.size).to.equal(2);
    expect(trie.has('skk.moe')).to.equal(true);
  });

  it('should be possible to set the null sequence.', () => {
    let trie = createTrie();

    trie.add('');
    expect(trie.has('')).to.equal(true);

    trie = createTrie(null, true);
    trie.add('');
    expect(trie.has('')).to.equal(true);
  });

  it('should be possible to delete items.', () => {
    const trie = createTrie();

    trie.add('rat');
    trie.add('rate');
    trie.add('tar');

    expect(trie.delete('')).to.equal(false);
    expect(trie.delete('')).to.equal(false);
    expect(trie.delete('hello')).to.equal(false);

    expect(trie.delete('rat')).to.equal(true);
    expect(trie.has('rat')).to.equal(false);
    expect(trie.has('rate')).to.equal(true);

    expect(trie.size).to.equal(2);

    expect(trie.delete('rate')).to.equal(true);
    expect(trie.size).to.equal(1);
    expect(trie.delete('tar')).to.equal(true);
    expect(trie.size).to.equal(0);
  });

  it('should be possible to delete items (hostname).', () => {
    const trie = createTrie(null, true);

    trie.add('skk.moe');
    trie.add('example.com');
    trie.add('moe.sb');

    expect(trie.delete('')).to.equal(false);
    expect(trie.delete('')).to.equal(false);
    expect(trie.delete('example.org')).to.equal(false);

    expect(trie.delete('skk.moe')).to.equal(true);
    expect(trie.has('skk.moe')).to.equal(false);
    expect(trie.has('moe.sb')).to.equal(true);

    expect(trie.size).to.equal(2);

    expect(trie.delete('example.com')).to.equal(true);
    expect(trie.size).to.equal(1);
    expect(trie.delete('moe.sb')).to.equal(true);
    expect(trie.size).to.equal(0);
  });

  it('should be possible to check the existence of a sequence in the Trie.', () => {
    const trie = createTrie();

    trie.add('romanesque');

    expect(trie.has('romanesque')).to.equal(true);
    expect(trie.has('roman')).to.equal(false);
    expect(trie.has('esque')).to.equal(false);
    expect(trie.has('')).to.equal(false);
  });

  it('should be possible to check the existence of a sequence in the Trie (hostname).', () => {
    const trie = createTrie(null, true);

    trie.add('example.org.skk.moe');

    expect(trie.has('example.org.skk.moe')).to.equal(true);
    expect(trie.has('skk.moe')).to.equal(false);
    expect(trie.has('example.org')).to.equal(false);
    expect(trie.has('')).to.equal(false);
  });

  it('should be possible to retrieve items matching the given prefix.', () => {
    const trie = createTrie();

    trie.add('roman');
    trie.add('esqueroman');
    trie.add('sesqueroman');
    trie.add('greek');

    expect(trie.find('roman')).to.deep.equal(['roman', 'esqueroman', 'sesqueroman']);
    expect(trie.find('man')).to.deep.equal(['roman', 'esqueroman', 'sesqueroman']);
    expect(trie.find('esqueroman')).to.deep.equal(['esqueroman', 'sesqueroman']);
    expect(trie.find('eek')).to.deep.equal(['greek']);
    expect(trie.find('hello')).to.deep.equal([]);
    expect(trie.find('')).to.deep.equal(['greek', 'roman', 'esqueroman', 'sesqueroman']);
  });

  it('should be possible to retrieve items matching the given prefix (hostname).', () => {
    const trie = createTrie(null, true);

    trie.add('example.com');
    trie.add('blog.example.com');
    trie.add('cdn.example.com');
    trie.add('example.org');

    expect(trie.find('example.com')).to.deep.equal(['example.com', 'cdn.example.com', 'blog.example.com']);
    expect(trie.find('com')).to.deep.equal(['example.com', 'cdn.example.com', 'blog.example.com']);
    expect(trie.find('.example.com')).to.deep.equal(['cdn.example.com', 'blog.example.com']);
    expect(trie.find('org')).to.deep.equal(['example.org']);
    expect(trie.find('example.net')).to.deep.equal([]);
    expect(trie.find('')).to.deep.equal(['example.org', 'example.com', 'cdn.example.com', 'blog.example.com']);
  });

  it('should be possible to create a trie from an arbitrary iterable.', () => {
    let trie = createTrie(['roman', 'esqueroman']);

    expect(trie.size).to.equal(2);
    expect(trie.has('roman')).to.equal(true);

    trie = createTrie(new Set(['skk.moe', 'example.com']), true);
    expect(trie.size).to.equal(2);
    expect(trie.has('skk.moe')).to.equal(true);
  });
});

([
  ['hostname mode off', false],
  ['hostname mode on', true]
] as const).forEach(([description, hostnameMode]) => {
  describe('surge domainset dedupe ' + description, () => {
    it('should not remove same entry', () => {
      const trie = createTrie(['.skk.moe', 'noc.one'], hostnameMode);

      expect(trie.find('.skk.moe')).to.deep.equal(['.skk.moe']);
      expect(trie.find('noc.one')).to.deep.equal(['noc.one']);
    });

    it('should match subdomain - 1', () => {
      const trie = createTrie(['www.noc.one', 'www.sukkaw.com', 'blog.skk.moe', 'image.cdn.skk.moe', 'cdn.sukkaw.net'], hostnameMode);

      expect(trie.find('.skk.moe')).to.deep.equal(['image.cdn.skk.moe', 'blog.skk.moe']);
      expect(trie.find('.sukkaw.com')).to.deep.equal(['www.sukkaw.com']);
    });

    it('should match subdomain - 2', () => {
      const trie = createTrie(['www.noc.one', 'www.sukkaw.com', '.skk.moe', 'blog.skk.moe', 'image.cdn.skk.moe', 'cdn.sukkaw.net'], hostnameMode);

      expect(trie.find('.skk.moe')).to.deep.equal(['.skk.moe', 'image.cdn.skk.moe', 'blog.skk.moe']);
      expect(trie.find('.sukkaw.com')).to.deep.equal(['www.sukkaw.com']);
    });

    it('should not remove non-subdomain', () => {
      const trie = createTrie(['skk.moe', 'sukkaskk.moe'], hostnameMode);
      expect(trie.find('.skk.moe')).to.deep.equal([]);
    });
  });
});

describe('smol tree', () => {
  it('should create simple tree - 1', () => {
    const trie = createTrie([
      '.skk.moe', 'blog.skk.moe', '.cdn.skk.moe', 'skk.moe',
      'www.noc.one', 'cdn.noc.one',
      '.blog.sub.example.com', 'sub.example.com', 'cdn.sub.example.com', '.sub.example.com'
    ], true, true);

    expect(trie.dump()).to.deep.equal([
      '.sub.example.com',
      'cdn.noc.one', 'www.noc.one',
      '.skk.moe'
    ]);
  });

  it('should create simple tree - 2', () => {
    const trie = createTrie([
      '.skk.moe', 'blog.skk.moe', '.cdn.skk.moe', 'skk.moe'
    ], true, true);

    expect(trie.dump()).to.deep.equal([
      '.skk.moe'
    ]);
  });

  it('should create simple tree - 2', () => {
    const trie = createTrie([
      '.blog.sub.example.com', 'cdn.sub.example.com', '.sub.example.com'
    ], true, true);

    expect(trie.dump()).to.deep.equal([
      '.sub.example.com'
    ]);

    trie.add('.sub.example.com');
    expect(trie.dump()).to.deep.equal([
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

    expect(trie.dump()).to.deep.equal([
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

    expect(trie.dump()).to.deep.equal([
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

    expect(trie.dump()).to.deep.equal([
      'anotherskk.moe',
      'blog.anotherskk.moe',
      'skk.moe',
      'blog.skk.moe'
    ]);

    trie.whitelist('.skk.moe');

    expect(trie.dump()).to.deep.equal([
      'anotherskk.moe',
      'blog.anotherskk.moe'
    ]);

    trie.whitelist('anotherskk.moe');
    expect(trie.dump()).to.deep.equal([
      'blog.anotherskk.moe'
    ]);

    trie.add('anotherskk.moe');
    trie.whitelist('.anotherskk.moe');

    expect(trie.dump()).to.deep.equal([]);
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

    expect(trie.dump()).to.deep.equal([
      'cdn.example.com', 'blog.cdn.example.com',
      '.skk.moe',
      '.t.co'
    ]);

    trie.whitelist('.t.co');
    expect(trie.dump()).to.deep.equal([
      'cdn.example.com', 'blog.cdn.example.com',
      '.skk.moe'
    ]);

    trie.whitelist('skk.moe');
    expect(trie.dump()).to.deep.equal(['cdn.example.com', 'blog.cdn.example.com']);

    trie.whitelist('cdn.example.com');
    expect(trie.dump()).to.deep.equal(['blog.cdn.example.com']);
  });
});
