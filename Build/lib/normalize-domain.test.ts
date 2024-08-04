import { describe, it } from 'mocha';

import { normalizeDomain } from './normalize-domain';

describe('normalizeDomain', () => {
  it('mine.torrent.pw', () => {
    console.log(normalizeDomain('mine.torrent.pw'));
  });
});
