import picocolors from 'picocolors';
import { task } from './lib/trace-runner';
import path from 'path';
import { fetchWithRetry } from './lib/fetch-retry';

const ASSETS_LIST = {
  'www-google-analytics-com_ga.js': 'https://unpkg.com/@adguard/scriptlets@1/dist/redirect-files/google-analytics-ga.js',
  'www-googletagservices-com_gpt.js': 'https://unpkg.com/@adguard/scriptlets@1/dist/redirect-files/googletagservices-gpt.js',
  'www-google-analytics-com_analytics.js': 'https://unpkg.com/@adguard/scriptlets@1/dist/redirect-files/google-analytics.js',
  'www-googlesyndication-com_adsbygoogle.js': 'https://unpkg.com/@adguard/scriptlets@1/dist/redirect-files/googlesyndication-adsbygoogle.js'
} as const;

const mockDir = path.resolve(import.meta.dir, '../Mock');

export const downloadMockAssets = task(import.meta.path, () => Promise.all(Object.entries(ASSETS_LIST).map(async ([filename, url]) => {
  const targetPath = path.join(mockDir, filename);

  const key = picocolors.gray(`Download ${filename}`);
  console.time(key);
  const res = await fetchWithRetry(url);
  await Bun.write(targetPath, res);
  console.timeEnd(key);
})));

if (import.meta.main) {
  downloadMockAssets();
}
