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
    // return;
  }

  const extractedPath = path.join(os.tmpdir(), `sukka-surge-last-build-extracted-${Date.now()}`);
  const filesList = buildOutputList.map(f => path.join('ruleset.skk.moe-master', f));

  await traceAsync(
    'Download and extract previous build',
    async () => {
      const [resp] = await Promise.all([
        fetchWithRetry('https://codeload.github.com/sukkalab/ruleset.skk.moe/tar.gz/master', defaultRequestInit),
        fsp.mkdir(extractedPath, { recursive: true })
      ]);
      await pipeline(
        Readable.fromWeb(resp.body!),
        tar.t({
          filter(p) {
            return filesList.some(f => p.startsWith(f));
          },
          // onentry is async, so we close entry manually after consumed
          noResume: true,
          async onentry(entry) {
            if (entry.type !== 'File') {
              // not a file, throw away
              console.log(entry.type, entry.path)
              entry.resume();
              return;
            }

            const relativeEntryPath = entry.path.replace('ruleset.skk.moe-master' + path.sep, '');

            const targetPath = path.join(__dirname, '..', relativeEntryPath);
            await fsp.mkdir(path.dirname(targetPath), { recursive: true });

            const targetFile = Bun.file(targetPath);
            const targetFileSink = targetFile.writer();

            // I don't know, but for some reason it is impossible to consume entry with AsyncIterator
            await new Promise<void>((resolve, reject) => {
              entry.on('data', (chunk) => {
                targetFileSink.write(chunk);
              });
              entry.on('end', resolve);
              entry.on('error', reject);
            });

            await targetFileSink.end();
          }
        })
      );
    }
  );
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
