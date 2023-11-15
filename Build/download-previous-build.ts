import tar from 'tar';
import fsp from 'fs/promises';
import path from 'path';
import os from 'os';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { readFileByLine } from './lib/fetch-remote-text-by-line';
import { isCI } from 'ci-info';
import { task, traceAsync } from './lib/trace-runner';

export const downloadPreviousBuild = task(__filename, async () => {
  const filesList = ['Clash', 'List'];

  let allFileExists = true;

  for await (const line of readFileByLine(path.resolve(__dirname, '../.gitignore'))) {
    if (
      (
        // line.startsWith('List/')
        line.startsWith('Modules/')
      ) && !line.endsWith('/')
    ) {
      filesList.push(line);

      if (!isCI) {
        allFileExists = await Bun.file(path.join(__dirname, '..', line)).exists();
        if (!allFileExists) {
          break;
        }
      }
    }
  }

  if (isCI) {
    allFileExists = false;
  }

  if (allFileExists) {
    console.log('All files exists, skip download.');
    return;
  }

  const extractedPath = path.join(os.tmpdir(), `sukka-surge-last-build-extracted-${Date.now()}`);

  await traceAsync(
    'Download and extract previous build',
    () => Promise.all([
      fetch('https://codeload.github.com/sukkalab/ruleset.skk.moe/tar.gz/master'),
      fsp.mkdir(extractedPath, { recursive: true })
    ]).then(([resp]) => pipeline(
      Readable.fromWeb(resp.body!),
      tar.x({
        cwd: extractedPath,
        /**
         * @param {string} p
         */
        filter(p) {
          return p.includes('/List/') || p.includes('/Modules/') || p.includes('/Clash/');
        }
      })
    ))
  );

  console.log('Files list:', filesList);

  await Promise.all(filesList.map(async p => {
    const src = path.join(extractedPath, 'ruleset.skk.moe-master', p);
    if (await Bun.file(src).exists()) {
      return fsp.cp(
        src,
        path.join(__dirname, '..', p),
        { force: true, recursive: true }
      );
    }
  }));

  // return fsp.unlink(extractedPath).catch(() => { });
});

export const downloadPublicSuffixList = task(__filename, async () => {
  const publicSuffixDir = path.resolve(__dirname, '../node_modules/.cache');
  const publicSuffixPath = path.join(publicSuffixDir, 'public_suffix_list_dat.txt');

  const [resp] = await Promise.all([
    fetch('https://publicsuffix.org/list/public_suffix_list.dat'),
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
