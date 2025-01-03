import path from 'node:path';
import fs from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { task } from './trace';
import { extract as tarExtract } from 'tar-fs';
import type { Headers as TarEntryHeaders } from 'tar-fs';
import zlib from 'node:zlib';
import undici from 'undici';
import picocolors from 'picocolors';
import { PUBLIC_DIR } from './constants/dir';

const GITHUB_CODELOAD_URL = 'https://codeload.github.com/sukkalab/ruleset.skk.moe/tar.gz/master';
const GITLAB_CODELOAD_URL = 'https://gitlab.com/SukkaW/ruleset.skk.moe/-/archive/master/ruleset.skk.moe-master.tar.gz';

export const downloadPreviousBuild = task(require.main === module, __filename)(async (span) => {
  if (fs.existsSync(PUBLIC_DIR)) {
    console.log(picocolors.blue('Public directory exists, skip downloading previous build'));
    return;
  }

  const tarGzUrl = await span.traceChildAsync('get tar.gz url', async () => {
    const resp = await undici.request(GITHUB_CODELOAD_URL, { method: 'HEAD' });
    if (resp.statusCode !== 200) {
      console.warn('Download previous build from GitHub failed! Status:', resp.statusCode);
      console.warn('Switch to GitLab');
      return GITLAB_CODELOAD_URL;
    }
    return GITHUB_CODELOAD_URL;
  });

  return span.traceChildAsync('download & extract previoud build', async () => {
    const respBody = undici.pipeline(
      tarGzUrl,
      {
        method: 'GET',
        headers: {
          'User-Agent': 'curl/8.9.1',
          // https://github.com/unjs/giget/issues/97
          // https://gitlab.com/gitlab-org/gitlab/-/commit/50c11f278d18fe1f3fb12eb595067216bb58ade2
          'sec-fetch-mode': 'same-origin'
        },
        // Allow redirects by default
        maxRedirections: 5
      },
      ({ statusCode, body }) => {
        if (statusCode !== 200) {
          console.warn('Download previous build failed! Status:', statusCode);
          if (statusCode === 404) {
            throw new Error('Download previous build failed! 404');
          }
        }

        return body;
      }
      // by default, undici.pipeline returns a duplex stream (for POST/PUT)
      // Since we are using GET, we need to end the write immediately
    ).end();

    const pathPrefix = 'ruleset.skk.moe-master/';

    const gunzip = zlib.createGunzip();
    const extract = tarExtract(
      PUBLIC_DIR,
      {
        ignore(_: string, header?: TarEntryHeaders) {
          if (header) {
            if (header.type !== 'file' && header.type !== 'directory') {
              return true;
            }
            if (header.type === 'file' && path.extname(header.name) === '.ts') {
              return true;
            }
          }

          return false;
        },
        map(header) {
          header.name = header.name.replace(pathPrefix, '');
          return header;
        }
      }
    );

    return pipeline(
      respBody,
      gunzip,
      extract
    );
  });
});
