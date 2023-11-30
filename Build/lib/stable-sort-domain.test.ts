import domainSorter from './stable-sort-domain';
import { describe, it, expect } from 'bun:test';

describe('stable-sort-domain', () => {
  it('.ks.cn, .tag.unclaimedproperty.ks.gov', () => {
    expect(domainSorter('.ks.cn', '.tag.unclaimedproperty.ks.gov')).toBe(-1);
  });
});
