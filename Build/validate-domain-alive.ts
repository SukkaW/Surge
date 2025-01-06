import { readFileByLine } from './lib/fetch-text-by-line';
import { processLine } from './lib/process-line';

import { SOURCE_DIR } from './constants/dir';
import path from 'node:path';
import { newQueue } from '@henrygd/queue';
import { isDomainAlive, keyedAsyncMutexWithQueue } from './lib/is-domain-alive';
import { fdir as Fdir } from 'fdir';

const queue = newQueue(32);

const deadDomains: string[] = [];
function onDomain(args: [string, boolean]) {
  if (!args[1]) {
    deadDomains.push(args[0]);
  }
}

(async () => {
  const domainSets = await new Fdir()
    .withFullPaths()
    .crawl(SOURCE_DIR + path.sep + 'domainset')
    .withPromise();
  const domainRules = await new Fdir()
    .withFullPaths()
    .crawl(SOURCE_DIR + path.sep + 'non_ip')
    .withPromise();

  await Promise.all([
    ...domainSets.map(runAgainstDomainset),
    ...domainRules.map(runAgainstRuleset)
  ]);

  console.log();
  console.log();
  console.log(JSON.stringify(deadDomains));
})();

export async function runAgainstRuleset(filepath: string) {
  const extname = path.extname(filepath);
  if (extname !== '.conf') {
    console.log('[skip]', filepath);
    return;
  }

  const promises: Array<Promise<void>> = [];

  for await (const l of readFileByLine(filepath)) {
    const line = processLine(l);
    if (!line) continue;
    const [type, domain] = line.split(',');
    switch (type) {
      case 'DOMAIN-SUFFIX':
      case 'DOMAIN': {
        promises.push(
          queue.add(() => keyedAsyncMutexWithQueue(domain, () => isDomainAlive(domain, type === 'DOMAIN-SUFFIX')))
            .then(onDomain)
        );
        break;
      }
      // no default
    }
  }

  await Promise.all(promises);
  console.log('[done]', filepath);
}

export async function runAgainstDomainset(filepath: string) {
  const extname = path.extname(filepath);
  if (extname !== '.conf') {
    console.log('[skip]', filepath);
    return;
  }

  const promises: Array<Promise<void>> = [];

  for await (const l of readFileByLine(filepath)) {
    const line = processLine(l);
    if (!line) continue;
    promises.push(
      queue.add(() => keyedAsyncMutexWithQueue(line, () => isDomainAlive(line, line[0] === '.')))
        .then(onDomain)
    );
  }

  await Promise.all(promises);
  console.log('[done]', filepath);
}
