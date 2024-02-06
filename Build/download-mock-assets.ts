import { task } from './trace';
import path from 'path';
import { fetchWithRetry } from './lib/fetch-retry';

const ASSETS_LIST = {
  'www-google-analytics-com_ga.js': 'https://raw.githubusercontent.com/AdguardTeam/Scriptlets/master/dist/redirect-files/google-analytics-ga.js',
  'www-googletagservices-com_gpt.js': 'https://raw.githubusercontent.com/AdguardTeam/Scriptlets/master/dist/redirect-files/googletagservices-gpt.js',
  'www-google-analytics-com_analytics.js': 'https://raw.githubusercontent.com/AdguardTeam/Scriptlets/master/dist/redirect-files/google-analytics.js',
  'www-googlesyndication-com_adsbygoogle.js': 'https://raw.githubusercontent.com/AdguardTeam/Scriptlets/master/dist/redirect-files/googlesyndication-adsbygoogle.js',
  'amazon-adsystem-com_amazon-apstag.js': 'https://raw.githubusercontent.com/AdguardTeam/Scriptlets/master/dist/redirect-files/amazon-apstag.js'
} as const;

const mockDir = path.resolve(import.meta.dir, '../Mock');

export const downloadMockAssets = task(import.meta.path, (span) => Promise.all(Object.entries(ASSETS_LIST).map(
  ([filename, url]) => span
    .traceChild(url)
    .traceAsyncFn(() => fetchWithRetry(url).then(res => Bun.write(path.join(mockDir, filename), res)))
)));

if (import.meta.main) {
  downloadMockAssets();
}
