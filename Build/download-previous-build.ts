import { existsSync, createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { readFileByLine } from './lib/fetch-text-by-line';
import { isCI } from 'ci-info';
import { task } from './trace';
import { defaultRequestInit, fetchWithRetry } from './lib/fetch-retry';
import tarStream from 'tar-stream';
import zlib from 'node:zlib';
import { Readable } from 'node:stream';

const IS_READING_BUILD_OUTPUT = 1 << 2;
const ALL_FILES_EXISTS = 1 << 3;

const GITHUB_CODELOAD_URL = 'https://codeload.github.com/sukkalab/ruleset.skk.moe/tar.gz/master';
const GITLAB_CODELOAD_URL = 'https://gitlab.com/SukkaW/ruleset.skk.moe/-/archive/master/ruleset.skk.moe-master.tar.gz';

export const downloadPreviousBuild = task(require.main === module, __filename)(async (span) => {
  const buildOutputList: string[] = [];

  let flag = 1 | ALL_FILES_EXISTS;

  await span
    .traceChild('read .gitignore')
    .traceAsyncFn(async () => {
      for await (const line of readFileByLine(path.resolve(__dirname, '../.gitignore'))) {
        if (line === '# $ build output') {
          flag = flag | IS_READING_BUILD_OUTPUT;
          continue;
        }
        if (!(flag & IS_READING_BUILD_OUTPUT)) {
          continue;
        }

        buildOutputList.push(line);

        if (!isCI && !existsSync(path.join(__dirname, '..', line))) {
          flag = flag & ~ALL_FILES_EXISTS;
        }
      }
    });

  if (isCI) {
    flag = flag & ~ALL_FILES_EXISTS;
  }

  if (flag & ALL_FILES_EXISTS) {
    console.log('All files exists, skip download.');
    return;
  }

  const filesList = buildOutputList.map(f => path.join('ruleset.skk.moe-master', f));

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
      // filter entry
      if (!filesList.some(f => entry.header.name.startsWith(f))) {
        entry.resume(); // Drain the entry
        continue;
      }

      const relativeEntryPath = entry.header.name.replace(pathPrefix, '');
      const targetPath = path.join(__dirname, '..', relativeEntryPath);

      await mkdir(path.dirname(targetPath), { recursive: true });
      await pipeline(entry, createWriteStream(targetPath));
    }
  });
});
