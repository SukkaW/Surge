import path from 'node:path';
import { OUTPUT_SURGE_DIR } from './constants/dir';
import tldts from 'tldts';
import { loosTldOptWithPrivateDomains } from './constants/loose-tldts-opt';
import runAgainstSourceFile from './lib/run-against-source-file';

(async () => {
  const rejectDomainCountMap = await runAgainstDomainset(new Map<string, number>(), path.join(OUTPUT_SURGE_DIR, 'domainset', 'reject.conf'));
  const rejectExtraDomainCountMap = await runAgainstDomainset(new Map<string, number>(), path.join(OUTPUT_SURGE_DIR, 'domainset', 'reject_extra.conf'));

  const rejectDomainCountArr = Array.from(rejectDomainCountMap).sort((a, b) => b[1] - a[1]).filter(([, count]) => count > 20);
  const rejectExtraDomainCountArr = Array.from(rejectExtraDomainCountMap).sort((a, b) => b[1] - a[1]).filter(([, count]) => count > 20);

  console.table(rejectDomainCountArr);
  console.table(rejectExtraDomainCountArr);
})();

async function runAgainstDomainset(rejectDomainCountMap: Map<string, number>, file: string) {
  await runAgainstSourceFile(
    file,
    (domain: string) => {
      const apexDomain = tldts.getDomain(domain, loosTldOptWithPrivateDomains);
      if (!apexDomain) {
        return;
      }

      rejectDomainCountMap.set(
        apexDomain,
        rejectDomainCountMap.has(apexDomain)
          ? rejectDomainCountMap.get(apexDomain)! + 1
          : 1
      );
    }
  );

  return rejectDomainCountMap;
}
