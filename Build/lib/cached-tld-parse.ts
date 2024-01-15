import { createCache } from './cache-apply';
import type { PublicSuffixList } from '@gorhill/publicsuffixlist';

let gothillGetDomainCache: ReturnType<typeof createCache> | null = null;
export const createCachedGorhillGetDomain = (gorhill: PublicSuffixList) => {
  gothillGetDomainCache ??= createCache('cached-gorhill-get-domain', true);
  return (domain: string) => {
    // we do know gothillGetDomainCache exists here
    return gothillGetDomainCache!.sync(domain, () => gorhill.getDomain(domain[0] === '.' ? domain.slice(1) : domain));
  };
};
