import { TTL, fsFetchCache } from './lib/cache-filesystem';
import { defaultRequestInit, fetchWithRetry } from './lib/fetch-retry';
import { createMemoizedPromise } from './lib/memo-promise';

export const getPublicSuffixListTextPromise = createMemoizedPromise(() => fsFetchCache.apply(
  'https://publicsuffix.org/list/public_suffix_list.dat',
  () => fetchWithRetry('https://publicsuffix.org/list/public_suffix_list.dat', defaultRequestInit).then(r => r.text()),
  {
    // https://github.com/publicsuffix/list/blob/master/.github/workflows/tld-update.yml
    // Though the action runs every 24 hours, the IANA list is updated every 7 days.
    // So a 3 day TTL should be enough.
    ttl: TTL.THREE_DAYS()
  }
));
