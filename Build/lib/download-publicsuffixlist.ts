import { deserializeArray, fsFetchCache, getFileContentHash, serializeArray } from './cache-filesystem';
import { createMemoizedPromise } from './memo-promise';

export const getPublicSuffixListTextPromise = createMemoizedPromise(() => fsFetchCache.applyWithHttp304<string[]>(
  'https://publicsuffix.org/list/public_suffix_list.dat',
  getFileContentHash(__filename),
  (r) => r.text().then(text => text.split('\n')),
  {
    // https://github.com/publicsuffix/list/blob/master/.github/workflows/tld-update.yml
    // Though the action runs every 24 hours, the IANA list is updated every 7 days.
    // So a 3 day TTL should be enough.
    serializer: serializeArray,
    deserializer: deserializeArray
  }
));
