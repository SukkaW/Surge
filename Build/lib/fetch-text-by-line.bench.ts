import { processLine, processLineFromReadline } from './process-line';
import { readFileByLine, readFileByLineLegacy } from './fetch-text-by-line';
import path from 'node:path';
import fsp from 'node:fs/promises';
import { SOURCE_DIR } from '../constants/dir';

const file = path.join(SOURCE_DIR, 'domainset/cdn.conf');

(async () => {
  const { bench, group, run } = await import('mitata');

  group(() => {
    bench('readFileByLine', () => processLineFromReadline(readFileByLine(file)));
    bench('readFileByLineLegacy', () => processLineFromReadline(readFileByLineLegacy(file)));
    bench('fsp.readFile', () => fsp.readFile(file, 'utf-8').then((content) => content.split('\n').filter(processLine)));
  });

  run();
})();
