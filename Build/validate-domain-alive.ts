import { SOURCE_DIR } from './constants/dir';
import path from 'node:path';
import { isDomainAlive } from './lib/is-domain-alive';
import { fdir as Fdir } from 'fdir';
import runAgainstSourceFile from './lib/run-against-source-file';

import cliProgress from 'cli-progress';
import { newQueue } from '@henrygd/queue';

const queue = newQueue(32);

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

  const bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
  bar.start(0, 0);

  await Promise.all([
    ...domainRules,
    ...domainSets
  ].map(
    filepath => runAgainstSourceFile(
      filepath,
      (domain: string, includeAllSubdomain: boolean) => {
        bar.setTotal(bar.getTotal() + 1);

        return queue.add(
          () => isDomainAlive(domain, includeAllSubdomain).then((alive) => {
            bar.increment();

            if (alive) {
              return;
            }
            deadDomains.push(includeAllSubdomain ? '.' + domain : domain);
          })
        );
      }
    ).then(() => console.log('[crawl]', filepath))
  ));

  await queue.done();

  bar.stop();

  console.log();
  console.log();
  console.log(JSON.stringify(deadDomains));
})();
