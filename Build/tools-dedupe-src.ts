import { fdir as Fdir } from 'fdir';
import path from 'node:path';
import fsp from 'node:fs/promises';
import { SOURCE_DIR } from './constants/dir';
import { readFileByLine } from './lib/fetch-text-by-line';

(async () => {
  const files = await new Fdir()
    .withFullPaths()
    .filter((filepath, isDirectory) => {
      if (isDirectory) return true;

      const extname = path.extname(filepath);

      return extname !== '.js' && extname !== '.ts';
    })
    .crawl(SOURCE_DIR)
    .withPromise();

  await Promise.all(files.map(dedupeFile));
})();

async function dedupeFile(file: string) {
  const set = new Set<string>();
  const result: string[] = [];

  for await (const line of readFileByLine(file)) {
    if (line.length === 0) {
      result.push(line);
      continue;
    }
    if (line[0] === '#') {
      result.push(line);
      continue;
    }
    if (set.has(line)) {
      // do nothing
    } else {
      set.add(line);
      result.push(line);
    }
  }

  return fsp.writeFile(file, result.join('\n') + '\n');
}
