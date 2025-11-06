import { SOURCE_DIR } from './constants/dir';
import path from 'node:path';
import { getMethods } from './lib/is-domain-alive';
import { fdir as Fdir } from 'fdir';
import runAgainstSourceFile from './lib/run-against-source-file';

import cliProgress from 'cli-progress';
import { newQueue } from '@henrygd/queue';

const queue = newQueue(32);

const deadDomains: string[] = [];

(async () => {
  const [
    { isDomainAlive, isRegisterableDomainAlive },
    domainSets,
    domainRules
  ] = await Promise.all([
    getMethods(),
    new Fdir()
      .withFullPaths()
      .filter((filePath, isDirectory) => {
        if (isDirectory) return false;
        const extname = path.extname(filePath);
        return extname === '.txt' || extname === '.conf';
      })
      .crawl(SOURCE_DIR + path.sep + 'domainset')
      .withPromise(),
    new Fdir()
      .withFullPaths()
      .filter((filePath, isDirectory) => {
        if (isDirectory) return false;
        const extname = path.extname(filePath);
        return extname === '.txt' || extname === '.conf';
      })
      .crawl(SOURCE_DIR + path.sep + 'non_ip')
      .withPromise()
  ]);

  const bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
  bar.start(0, 0);

  void Promise.all([
    ...domainRules,
    ...domainSets
  ].map(
    filepath => runAgainstSourceFile(
      filepath,
      (domain: string, includeAllSubdomain: boolean) => {
        bar.setTotal(bar.getTotal() + 1);

        return queue.add(async () => {
          let registerableDomainAlive, registerableDomain, alive: boolean | undefined;

          if (includeAllSubdomain) {
            // we only need to check apex domain, because we don't know if there is any stripped subdomain
            ({ alive: registerableDomainAlive, registerableDomain } = await isRegisterableDomainAlive(domain));
          } else {
            ({ alive, registerableDomainAlive, registerableDomain } = await isDomainAlive(domain));
          }

          bar.increment();

          if (!registerableDomainAlive) {
            if (registerableDomain) {
              deadDomains.push('.' + registerableDomain);
            }
          } else if (!includeAllSubdomain && alive != null && !alive) {
            deadDomains.push(domain);
          }
        });
      }
    ).then(() => console.log('[crawl]', filepath))
  ));

  await queue.done();

  bar.stop();

  console.log();
  console.log();
  console.log(JSON.stringify(deadDomains));
})();
