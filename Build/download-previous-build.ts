import tar from 'tar';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import os from 'os';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { readFileByLine } from './lib/fetch-remote-text-by-line';
import { isCI } from 'ci-info';
import { task, traceAsync } from './lib/trace-runner';
import { defaultRequestInit, fetchWithRetry } from './lib/fetch-retry';

const IS_READING_BUILD_OUTPUT = 1 << 2;
const ALL_FILES_EXISTS = 1 << 3;

export const downloadPreviousBuild = task(__filename, async () => {
  const buildOutputList: string[] = [];

  let flag = 1 | ALL_FILES_EXISTS;

  for await (const line of readFileByLine(path.resolve(__dirname, '../.gitignore'))) {
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
      if (!fs.existsSync(path.join(__dirname, '..', line))) {
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

  const extractedPath = path.join(os.tmpdir(), `sukka-surge-last-build-extracted-${Date.now()}`);
  const filesList = buildOutputList.map(f => path.join('ruleset.skk.moe-master', f));

  await traceAsync(
    'Download and extract previous build',
    () => Promise.all([
      fetchWithRetry('https://codeload.github.com/sukkalab/ruleset.skk.moe/tar.gz/master', defaultRequestInit),
      fsp.mkdir(extractedPath, { recursive: true })
    ]).then(([resp]) => pipeline(
      Readable.fromWeb(resp.body!),
      tar.x({
        cwd: extractedPath,
        filter(p) {
          return filesList.some(f => p.startsWith(f));
        }
      })
    ))
  );

  await Promise.all(buildOutputList.map(async p => {
    const src = path.join(extractedPath, 'ruleset.skk.moe-master', p);

    if (fs.existsSync(src)) { // Bun.file().exists() doesn't check directory
      return fsp.cp(
        src,
        path.join(__dirname, '..', p),
        { force: true, recursive: true }
      );
    }
  }));
});

export const downloadPublicSuffixList = task(__filename, async () => {
  const publicSuffixDir = path.resolve(__dirname, '../node_modules/.cache');
  const publicSuffixPath = path.join(publicSuffixDir, 'public_suffix_list_dat.txt');

  const [resp] = await Promise.all([
    fetchWithRetry('https://publicsuffix.org/list/public_suffix_list.dat', defaultRequestInit),
    fsp.mkdir(publicSuffixDir, { recursive: true })
  ]);

  return Bun.write(publicSuffixPath, resp);
}, 'download-publicsuffixlist');

if (import.meta.main) {
  Promise.all([
    downloadPreviousBuild(),
    downloadPublicSuffixList()
  ]);
}
