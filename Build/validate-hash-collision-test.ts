/* eslint-disable no-await-in-loop -- no concurrent */
import { fdir as Fdir } from 'fdir';
import { OUTPUT_SURGE_DIR } from './constants/dir';
import path from 'node:path';
import { readFileIntoProcessedArray } from './lib/fetch-text-by-line';
import { xxhash3 } from 'hash-wasm';

(async () => {
  const hashMap = new Map<string, Set<string>>();

  const runHash = async (inputs: string[]) => {
    for (const input of inputs) {
      const hash = await xxhash3(input);
      if (!hashMap.has(hash)) {
        hashMap.set(hash, new Set());
      }
      hashMap.get(hash)!.add(input);
    }
  };

  const files = await new Fdir()
    .withRelativePaths()
    .crawl(OUTPUT_SURGE_DIR)
    .withPromise();

  for (const file of files) {
    const fullpath = path.join(OUTPUT_SURGE_DIR, file);
    if (file.startsWith('domainset' + path.sep)) {
      await runHash((await readFileIntoProcessedArray(fullpath)).map(i => (i[0] === '.' ? i.slice(1) : i)));
    } else if (file.startsWith('non_ip' + path.sep)) {
      await runHash((await readFileIntoProcessedArray(fullpath)).map(i => i.split(',')[1]));
    }
  }

  console.log(hashMap.size);
  let collision = 0;
  hashMap.forEach((v, k) => {
    if (v.size > 1) {
      collision++;
      console.log(k, '=>', v);
    }
  });
  if (collision === 0) {
    console.log(hashMap);
  }
})();
