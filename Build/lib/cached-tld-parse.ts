import * as tldts from 'tldts';
import { createCache } from './cache-apply';
import type { PublicSuffixList } from 'gorhill-publicsuffixlist';

const cache = createCache('cached-tld-parse', true);

const sharedConfig = { allowPrivateDomains: true };

export const parse = (domain: string) => cache.sync(domain, () => tldts.parse(domain, sharedConfig));

let gothillGetDomainCache: ReturnType<typeof createCache> | null = null;
export const createCachedGorhillGetDomain = (gorhill: PublicSuffixList) => {
  return (domain: string) => {
    gothillGetDomainCache ??= createCache('cached-gorhill-get-domain', true);
    return gothillGetDomainCache.sync(domain, () => gorhill.getDomain(domain[0] === '.' ? domain.slice(1) : domain));
  };
};
