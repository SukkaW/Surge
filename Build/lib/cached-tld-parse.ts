import * as tldts from 'tldts';
import { createCache } from './cache-apply';
import type { PublicSuffixList } from '@gorhill/publicsuffixlist';

const cache = createCache('cached-tld-parse', true);
const cache2 = createCache('cached-tld-parse2', true);

const sharedConfig = { allowPrivateDomains: true };
const sharedConfig2 = { allowPrivateDomains: true, detectIp: false };

/** { allowPrivateDomains: true } */
export const parse = (domain: string) => cache.sync(domain, () => tldts.parse(domain, sharedConfig));
/** { allowPrivateDomains: true, detectIp: false } */
export const parse2 = (domain: string) => cache2.sync(domain, () => tldts.parse(domain, sharedConfig2));

let gothillGetDomainCache: ReturnType<typeof createCache> | null = null;
export const createCachedGorhillGetDomain = (gorhill: PublicSuffixList) => {
  return (domain: string) => {
    gothillGetDomainCache ??= createCache('cached-gorhill-get-domain', true);
    return gothillGetDomainCache.sync(domain, () => gorhill.getDomain(domain[0] === '.' ? domain.slice(1) : domain));
  };
};
