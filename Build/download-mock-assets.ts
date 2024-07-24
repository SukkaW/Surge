import { task } from './trace';
import path from 'path';
import fs from 'fs';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { fetchWithRetry } from './lib/fetch-retry';

const ASSETS_LIST = {
  'www-google-analytics-com_ga.js': 'https://raw.githubusercontent.com/AdguardTeam/Scriptlets/master/dist/redirect-files/google-analytics-ga.js',
  'www-googletagservices-com_gpt.js': 'https://raw.githubusercontent.com/AdguardTeam/Scriptlets/master/dist/redirect-files/googletagservices-gpt.js',
  'www-google-analytics-com_analytics.js': 'https://raw.githubusercontent.com/AdguardTeam/Scriptlets/master/dist/redirect-files/google-analytics.js',
  'www-googlesyndication-com_adsbygoogle.js': 'https://raw.githubusercontent.com/AdguardTeam/Scriptlets/master/dist/redirect-files/googlesyndication-adsbygoogle.js',
  'amazon-adsystem-com_amazon-apstag.js': 'https://raw.githubusercontent.com/AdguardTeam/Scriptlets/master/dist/redirect-files/amazon-apstag.js'
} as const;

const mockDir = path.resolve(__dirname, '../Mock');

export const downloadMockAssets = task(require.main === module, __filename)((span) => Promise.all(Object.entries(ASSETS_LIST).map(
  ([filename, url]) => span
    .traceChild(url)
    .traceAsyncFn(() => fetchWithRetry(url).then(res => {
      const src = path.join(mockDir, filename);
      if (!res.body) {
        throw new Error(`Empty body from ${url}`);
      }

      const writeStream = fs.createWriteStream(src, { encoding: 'utf-8' });
      return pipeline(
        Readable.fromWeb(res.body),
        writeStream
      );
    }))
)));
