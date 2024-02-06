import { createCache } from './cache-apply';
import type { PublicSuffixList } from '@gorhill/publicsuffixlist';

let gorhillGetDomainCache: ReturnType<typeof createCache> | null = null;
export const createCachedGorhillGetDomain = (gorhill: PublicSuffixList) => {
  gorhillGetDomainCache ??= createCache('cached-gorhill-get-domain', true);
  return (domain: string) => gorhillGetDomainCache! // we do know gothillGetDomainCache exists here
    .sync(domain, () => gorhill.getDomain(domain[0] === '.' ? domain.slice(1) : domain));
};
