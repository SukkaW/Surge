import { bench, group, run } from 'mitata';
import { processLine, processLineFromReadline } from './process-line';
import { readFileByLine } from './fetch-text-by-line';
import path from 'node:path';
import fsp from 'node:fs/promises';
import { SOURCE_DIR } from '../constants/dir';

const file = path.join(SOURCE_DIR, 'domainset/cdn.conf');

group('read file by line', () => {
  bench('readFileByLine', () => processLineFromReadline(readFileByLine(file)));
  bench('fsp.readFile', () => fsp.readFile(file, 'utf-8').then((content) => content.split('\n').filter(processLine)));
});

run();
