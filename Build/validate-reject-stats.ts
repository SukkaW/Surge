import path from 'node:path';
import { OUTPUT_SURGE_DIR } from './constants/dir';
import tldts from 'tldts';
import { loosTldOptWithPrivateDomains } from './constants/loose-tldts-opt';
import runAgainstSourceFile from './lib/run-against-source-file';

(async () => {
  const rejectDomainCountMap = new Map<string, number>();
  const rejectExtraDomainCountMap = new Map<string, number>();

  const callback = (map: Map<string, number>) => (domain: string) => {
    const apexDomain = tldts.getDomain(domain, loosTldOptWithPrivateDomains);
    if (!apexDomain) {
      return;
    }

    map.set(
      apexDomain,
      map.has(apexDomain)
        ? map.get(apexDomain)! + 1
        : 1
    );
  };

  await runAgainstSourceFile(
    path.join(OUTPUT_SURGE_DIR, 'domainset', 'reject.conf'),
    callback(rejectDomainCountMap)
  );
  await runAgainstSourceFile(
    path.join(OUTPUT_SURGE_DIR, 'domainset', 'reject_extra.conf'),
    callback(rejectExtraDomainCountMap)
  );

  const rejectDomainCountArr = Array.from(rejectDomainCountMap).sort((a, b) => b[1] - a[1]).filter(([, count]) => count > 20);
  const rejectExtraDomainCountArr = Array.from(rejectExtraDomainCountMap).sort((a, b) => b[1] - a[1]).filter(([, count]) => count > 20);

  console.table(rejectDomainCountArr);
  console.table(rejectExtraDomainCountArr);
})();
