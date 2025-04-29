import { SOURCE_DIR } from './constants/dir';
import path from 'node:path';
import { newQueue } from '@henrygd/queue';
import { isDomainAlive, keyedAsyncMutexWithQueue } from './lib/is-domain-alive';
import { fdir as Fdir } from 'fdir';
import runAgainstSourceFile from './lib/run-against-source-file';

const queue = newQueue(24);

const deadDomains: string[] = [];
function onDomain(args: [string, boolean]) {
  if (!args[1]) {
    deadDomains.push(args[0]);
  }
}

(async () => {
  const domainSets = await new Fdir()
    .withFullPaths()
    .filter((filePath, isDirectory) => {
      if (isDirectory) return false;
      const extname = path.extname(filePath);
      return extname === '.txt' || extname === '.conf';
    })
    .crawl(SOURCE_DIR + path.sep + 'domainset')
    .withPromise();
  const domainRules = await new Fdir()
    .withFullPaths()
    .filter((filePath, isDirectory) => {
      if (isDirectory) return false;
      const extname = path.extname(filePath);
      return extname === '.txt' || extname === '.conf';
    })
    .crawl(SOURCE_DIR + path.sep + 'non_ip')
    .withPromise();

  await Promise.all([
    ...domainRules,
    ...domainSets
  ].map(filepath => runAgainstSourceFile(
    filepath,
    (domain: string, includeAllSubdomain: boolean) => queue.add(
      () => keyedAsyncMutexWithQueue(
        domain,
        () => isDomainAlive(domain, includeAllSubdomain)
      ).then(onDomain)
    ).then(() => console.log('[done]', filepath))
  )));

  console.log();
  console.log();
  console.log(JSON.stringify(deadDomains));
})();
