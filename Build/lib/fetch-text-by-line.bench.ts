import { readFileByLine, readFileByLineNew } from './fetch-text-by-line';
import path from 'node:path';
import fsp from 'node:fs/promises';
import { OUTPUT_SURGE_DIR } from '../constants/dir';

const file = path.join(OUTPUT_SURGE_DIR, 'domainset/reject_extra.conf');

(async () => {
  const { bench, group, run } = await import('mitata');

  group(() => {
    bench('readFileByLine', () => Array.fromAsync(readFileByLine(file)));
    bench('readFileByLineNew', async () => Array.fromAsync(await readFileByLineNew(file)));
    bench('fsp.readFile', () => fsp.readFile(file, 'utf-8').then((content) => content.split('\n')));
  });

  run();
})();
