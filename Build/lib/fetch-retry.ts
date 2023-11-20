// @ts-expect-error -- missing types
import createFetchRetry from '@vercel/fetch-retry';

export const defaultRequestInit: RequestInit = {
  headers: {
    'User-Agent': 'curl/8.1.2 (https://github.com/SukkaW/Surge)'
  }
}

export const fetchWithRetry: typeof fetch = createFetchRetry(fetch);
