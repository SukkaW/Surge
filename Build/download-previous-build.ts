import { existsSync, createWriteStream } from 'fs';
import { mkdir } from 'fs/promises';
import path from 'path';
import { pipeline } from 'stream/promises';
import { readFileByLine } from './lib/fetch-text-by-line';
import { isCI } from 'ci-info';
import { task } from './trace';
import { defaultRequestInit, fetchWithRetry } from './lib/fetch-retry';
import tarStream from 'tar-stream';
import zlib from 'zlib';
import { Readable } from 'stream';

const IS_READING_BUILD_OUTPUT = 1 << 2;
const ALL_FILES_EXISTS = 1 << 3;

export const downloadPreviousBuild = task(import.meta.main, import.meta.path)(async (span) => {
  const buildOutputList: string[] = [];

  let flag = 1 | ALL_FILES_EXISTS;

  await span
    .traceChild('read .gitignore')
    .traceAsyncFn(async () => {
      for await (const line of readFileByLine(path.resolve(import.meta.dir, '../.gitignore'))) {
        if (line === '# $ build output') {
          flag = flag | IS_READING_BUILD_OUTPUT;
          continue;
        }
        if (!(flag & IS_READING_BUILD_OUTPUT)) {
          continue;
        }

        buildOutputList.push(line);

        if (!isCI) {
          // Bun.file().exists() doesn't check directory
          if (!existsSync(path.join(import.meta.dir, '..', line))) {
            flag = flag & ~ALL_FILES_EXISTS;
          }
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

  return span
    .traceChild('download & extract previoud build')
    .traceAsyncFn(async () => {
      const resp = await fetchWithRetry('https://codeload.github.com/sukkalab/ruleset.skk.moe/tar.gz/master', defaultRequestInit);

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

      const pathPrefix = `ruleset.skk.moe-master${path.sep}`;

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
        const targetPath = path.join(import.meta.dir, '..', relativeEntryPath);

        await mkdir(path.dirname(targetPath), { recursive: true });
        await pipeline(entry, createWriteStream(targetPath));
      }
    });
});
