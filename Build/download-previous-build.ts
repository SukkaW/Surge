import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { readFileByLine } from './lib/fetch-text-by-line';
import { isCI } from 'ci-info';
import { task, traceAsync } from './lib/trace-runner';
import { defaultRequestInit, fetchWithRetry } from './lib/fetch-retry';
import tarStream from 'tar-stream';
import zlib from 'zlib';

const IS_READING_BUILD_OUTPUT = 1 << 2;
const ALL_FILES_EXISTS = 1 << 3;

export const downloadPreviousBuild = task(import.meta.path, async () => {
  const buildOutputList: string[] = [];

  let flag = 1 | ALL_FILES_EXISTS;

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
      if (!fs.existsSync(path.join(import.meta.dir, '..', line))) {
        flag = flag & ~ALL_FILES_EXISTS;
      }
    }
  }

  if (isCI) {
    flag = flag & ~ALL_FILES_EXISTS;
  }

  if (flag & ALL_FILES_EXISTS) {
    console.log('All files exists, skip download.');
    return;
  }

  const filesList = buildOutputList.map(f => path.join('ruleset.skk.moe-master', f));

  await traceAsync(
    'Download and extract previous build',
    async () => {
      const resp = await fetchWithRetry('https://codeload.github.com/sukkalab/ruleset.skk.moe/tar.gz/master', defaultRequestInit);

      if (!resp.body) {
        throw new Error('Download previous build failed! No body found');
      }

      const extract = tarStream.extract();
      Readable.fromWeb(resp.body).pipe(zlib.createGunzip()).pipe(extract);

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

        const relativeEntryPath = entry.header.name.replace(`ruleset.skk.moe-master${path.sep}`, '');
        const targetPath = path.join(import.meta.dir, '..', relativeEntryPath);

        await fsp.mkdir(path.dirname(targetPath), { recursive: true });
        await pipeline(
          entry,
          fs.createWriteStream(targetPath)
        );
      }
    }
  );
});

if (import.meta.main) {
  downloadPreviousBuild();
}
