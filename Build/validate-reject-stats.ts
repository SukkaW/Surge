import path from 'node:path';
import { readFileByLine } from './lib/fetch-text-by-line';
import { OUTPUT_SURGE_DIR } from './constants/dir';
import { processLine } from './lib/process-line';
import tldts from 'tldts';
import { loosTldOptWithPrivateDomains } from './constants/loose-tldts-opt';

(async () => {
  const rejectDomainCountMap = await runAgainstDomainset(new Map<string, number>(), path.join(OUTPUT_SURGE_DIR, 'domainset', 'reject.conf'));
  const rejectExtraDomainCountMap = await runAgainstDomainset(new Map<string, number>(), path.join(OUTPUT_SURGE_DIR, 'domainset', 'reject_extra.conf'));

  const rejectDomainCountArr = Array.from(rejectDomainCountMap).sort((a, b) => b[1] - a[1]).filter(([, count]) => count > 20);
  const rejectExtraDomainCountArr = Array.from(rejectExtraDomainCountMap).sort((a, b) => b[1] - a[1]).filter(([, count]) => count > 20);

  console.table(rejectDomainCountArr);
  console.table(rejectExtraDomainCountArr);
})();

async function runAgainstDomainset(rejectDomainCountMap: Map<string, number>, file: string) {
  for await (const line of readFileByLine(file)) {
    if (!processLine(line)) {
      continue;
    }
    const apexDomain = tldts.getDomain(line, loosTldOptWithPrivateDomains);
    if (!apexDomain) {
      continue;
    }

    rejectDomainCountMap.set(
      apexDomain,
      rejectDomainCountMap.has(apexDomain)
        ? rejectDomainCountMap.get(apexDomain)! + 1
        : 1
    );
  }

  return rejectDomainCountMap;
}
