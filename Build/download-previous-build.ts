import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { task } from './trace';
import { defaultRequestInit, fetchWithRetry } from './lib/fetch-retry';
import tarStream from 'tar-stream';
import zlib from 'node:zlib';
import { Readable } from 'node:stream';

const GITHUB_CODELOAD_URL = 'https://codeload.github.com/sukkalab/ruleset.skk.moe/tar.gz/master';
const GITLAB_CODELOAD_URL = 'https://gitlab.com/SukkaW/ruleset.skk.moe/-/archive/master/ruleset.skk.moe-master.tar.gz';

export const downloadPreviousBuild = task(require.main === module, __filename)(async (span) => {
  const tarGzUrl = await span.traceChildAsync('get tar.gz url', async () => {
    const resp = await fetchWithRetry(GITHUB_CODELOAD_URL, {
      ...defaultRequestInit,
      method: 'HEAD',
      retry: {
        retryOnNon2xx: false
      }
    });
    if (resp.status !== 200) {
      console.warn('Download previous build from GitHub failed! Status:', resp.status);
      console.warn('Switch to GitLab');
      return GITLAB_CODELOAD_URL;
    }
    return GITHUB_CODELOAD_URL;
  });

  const publicDir = path.resolve(__dirname, '..', 'public');

  return span.traceChildAsync('download & extract previoud build', async () => {
    const resp = await fetchWithRetry(tarGzUrl, {
      headers: {
        'User-Agent': 'curl/8.9.1',
        // https://github.com/unjs/giget/issues/97
        // https://gitlab.com/gitlab-org/gitlab/-/commit/50c11f278d18fe1f3fb12eb595067216bb58ade2
        'sec-fetch-mode': 'same-origin'
      },
      // https://github.com/unjs/giget/issues/97
      // https://gitlab.com/gitlab-org/gitlab/-/commit/50c11f278d18fe1f3fb12eb595067216bb58ade2

      mode: 'same-origin',
      retry: {
        retryOnNon2xx: false
      }
    });

    if (resp.status !== 200) {
      console.warn('Download previous build failed! Status:', resp.status);
      if (resp.status === 404) {
        return;
      }
    }

    if (!resp.body) {
      throw new Error('Download previous build failed! No body found');
    }

    const gunzip = zlib.createGunzip();
    const extract = tarStream.extract();

    pipeline(
      Readable.fromWeb(resp.body),
      gunzip,
      extract
    );

    const pathPrefix = 'ruleset.skk.moe-master/';

    for await (const entry of extract) {
      if (entry.header.type !== 'file') {
        entry.resume(); // Drain the entry
        continue;
      }

      const relativeEntryPath = entry.header.name.replace(pathPrefix, '');
      const targetPath = path.join(publicDir, relativeEntryPath);

      await mkdir(path.dirname(targetPath), { recursive: true });
      await pipeline(entry, createWriteStream(targetPath));
    }
  });
});
