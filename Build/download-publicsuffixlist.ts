import { TTL, fsCache } from './lib/cache-filesystem';
import { defaultRequestInit, fetchWithRetry } from './lib/fetch-retry';
import { createMemoizedPromise } from './lib/memo-promise';
import { traceAsync } from './lib/trace-runner';

export const getPublicSuffixListTextPromise = createMemoizedPromise(() => traceAsync(
  'obtain public_suffix_list',
  () => fsCache.apply(
    'https://publicsuffix.org/list/public_suffix_list.dat',
    () => fetchWithRetry('https://publicsuffix.org/list/public_suffix_list.dat', defaultRequestInit).then(r => r.text()),
    {
      // https://github.com/publicsuffix/list/blob/master/.github/workflows/tld-update.yml
      // Though the action runs every 24 hours, the IANA list is updated every 7 days.
      // So a 3 day TTL should be enough.
      ttl: TTL.THREE_DAYS()
    }
  )
));
