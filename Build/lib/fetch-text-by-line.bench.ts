import { bench, group, run } from 'mitata';
import { processLine, processLineFromReadline } from './process-line';
import { readFileByLine } from './fetch-text-by-line';
import path from 'path';
import fsp from 'fs/promises';

const file = path.resolve(__dirname, '../../Source/domainset/cdn.conf');

group('read file by line', () => {
  bench('readline', () => processLineFromReadline(readFileByLine(file)));

  bench('fsp.readFile', () => fsp.readFile(file, 'utf-8').then((content) => content.split('\n').filter(processLine)));

  bench('Bun.file', () => Bun.file(file).text().then((content) => content.split('\n').filter(processLine)));
});

run();
