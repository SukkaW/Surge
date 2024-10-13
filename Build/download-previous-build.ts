import path from 'node:path';
import fs from 'node:fs';
import { pipeline } from 'node:stream/promises';
import picocolors from 'picocolors';
import { task } from './trace';
import { extract as tarExtract } from 'tar-fs';
import type { Headers as TarEntryHeaders } from 'tar-fs';
import zlib from 'node:zlib';
import { fetchWithRetry } from './lib/fetch-retry';
import { Readable } from 'node:stream';

const GITHUB_CODELOAD_URL = 'https://codeload.github.com/sukkalab/ruleset.skk.moe/tar.gz/master';
const GITLAB_CODELOAD_URL = 'https://gitlab.com/SukkaW/ruleset.skk.moe/-/archive/master/ruleset.skk.moe-master.tar.gz';

export const downloadPreviousBuild = task(require.main === module, __filename)(async (span) => {
  const publicDir = path.resolve(__dirname, '..', 'public');

  if (fs.existsSync(publicDir)) {
    console.log(picocolors.blue('Public directory exists, skip downloading previous build'));
    return;
  }

  const tarGzUrl = await span.traceChildAsync('get tar.gz url', async () => {
    const resp = await fetchWithRetry(GITHUB_CODELOAD_URL, { method: 'HEAD' });
    if (resp.status !== 200) {
      console.warn('Download previous build from GitHub failed! Status:', resp.status);
      console.warn('Switch to GitLab');
      return GITLAB_CODELOAD_URL;
    }
    return GITHUB_CODELOAD_URL;
  });

  return span.traceChildAsync('download & extract previoud build', async () => {
    const resp = await fetchWithRetry(tarGzUrl, {
      headers: {
        'User-Agent': 'curl/8.9.1',
        // https://github.com/unjs/giget/issues/97
        // https://gitlab.com/gitlab-org/gitlab/-/commit/50c11f278d18fe1f3fb12eb595067216bb58ade2
        'sec-fetch-mode': 'same-origin'
      },
      mode: 'same-origin'
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

    const pathPrefix = 'ruleset.skk.moe-master/';

    const gunzip = zlib.createGunzip();
    const extract = tarExtract(
      publicDir,
      {
        ignore: tarOnIgnore,
        map(header) {
          header.name = header.name.replace(pathPrefix, '');
          return header;
        }
      }
    );

    return pipeline(
      Readable.fromWeb(resp.body),
      gunzip,
      extract
    );
  });
});

function tarOnIgnore(_: string, header?: TarEntryHeaders) {
  if (header) {
    if (header.type !== 'file' && header.type !== 'directory') {
      return true;
    }

    const extname = path.extname(header.name);
    if (extname === '.ts') {
      return true;
    }
  }

  return false;
}
