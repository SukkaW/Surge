import { defaultRequestInit, fetchWithRetry } from './lib/fetch-retry';
import { createMemoizedPromise } from './lib/memo-promise';
import { traceAsync } from './lib/trace-runner';

export const getPublicSuffixListTextPromise = createMemoizedPromise(() => traceAsync('obtain public_suffix_list', () => fetchWithRetry('https://publicsuffix.org/list/public_suffix_list.dat', defaultRequestInit).then(r => r.text())));
