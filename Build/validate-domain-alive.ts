import { SOURCE_DIR } from './constants/dir';
import path from 'node:path';
import { isDomainAlive } from './lib/is-domain-alive';
import { fdir as Fdir } from 'fdir';
import runAgainstSourceFile from './lib/run-against-source-file';

const deadDomains: string[] = [];

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

  const promises: Array<Promise<void>> = [];

  await Promise.all([
    ...domainRules,
    ...domainSets
  ].map(
    filepath => runAgainstSourceFile(
      filepath,
      (domain: string, includeAllSubdomain: boolean) => promises.push(
        isDomainAlive(domain, includeAllSubdomain).then((alive) => {
          if (alive) {
            return;
          }
          deadDomains.push(includeAllSubdomain ? '.' + domain : domain);
        })
      )
    ).then(() => console.log('[crawl]', filepath))
  ));

  await Promise.all(promises);

  console.log();
  console.log();
  console.log(JSON.stringify(deadDomains));
})();
