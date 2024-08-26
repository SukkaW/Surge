import { bench, group, run } from 'mitata';
import { processLine, processLineFromReadline } from './process-line';
import { readFileByLine } from './fetch-text-by-line';
import path from 'node:path';
import fsp from 'node:fs/promises';

const file = path.resolve(__dirname, '../../Source/domainset/cdn.conf');

group('read file by line', () => {
  bench('readFileByLine', () => processLineFromReadline(readFileByLine(file)));
  bench('fsp.readFile', () => fsp.readFile(file, 'utf-8').then((content) => content.split('\n').filter(processLine)));
});

run();
