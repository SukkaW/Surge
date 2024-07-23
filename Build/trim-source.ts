import path from 'path';
import fsp from 'fs/promises';
import { fdir as Fdir } from 'fdir';
import { readFileByLine } from './lib/fetch-text-by-line';

const sourceDir = path.resolve(__dirname, '../Source');

(async () => {
  const promises: Array<Promise<unknown>> = [];

  const paths = await new Fdir()
    .withFullPaths()
    // .exclude((dirName, dirPath) => {
    //   if (dirName === 'domainset' || dirName === 'ip' || dirName === 'non_ip') {
    //     return false;
    //   }
    //   console.error(picocolors.red(`[build-comman] Unknown dir: ${dirPath}`));
    //   return true;
    // })
    .filter((filepath, isDirectory) => {
      if (isDirectory) return true;

      const extname = path.extname(filepath);
      if (extname === '.js' || extname === '.ts') {
        return false;
      }

      return true;
    })
    .crawl(sourceDir)
    .withPromise();

  for (let i = 0, len = paths.length; i < len; i++) {
    const fullPath = paths[i];
    promises.push(trimFileLines(fullPath));
  }

  return Promise.all(promises);
})();

async function trimFileLines(file: string) {
  let result = '';
  for await (const line of readFileByLine(file)) {
    result += line.trim() + '\n';
  }

  return fsp.writeFile(file, result);
}
