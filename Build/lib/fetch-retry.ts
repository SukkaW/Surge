// @ts-expect-error -- missing types
import createFetchRetry from '@vercel/fetch-retry';

export const fetchWithRetry: typeof fetch = createFetchRetry(fetch);
