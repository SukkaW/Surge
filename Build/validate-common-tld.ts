import path from 'node:path';
import { OUTPUT_SURGE_DIR } from './constants/dir';
import tldts from 'tldts-experimental';
import { looseTldtsOpt } from './constants/loose-tldts-opt';
import runAgainstSourceFile from './lib/run-against-source-file';
import { Counter } from 'foxts/counter';

(async () => {
  const tldCountMap = new Counter();

  const callback = (map: Counter<string>) => (domain: string) => {
    const tld = tldts.getPublicSuffix(domain, looseTldtsOpt);
    if (!tld) {
      return;
    }

    map.incr(tld);
  };

  await runAgainstSourceFile(path.join(OUTPUT_SURGE_DIR, 'domainset', 'apple_cdn.conf'), callback(tldCountMap), 'domainset');
  await runAgainstSourceFile(path.join(OUTPUT_SURGE_DIR, 'domainset', 'cdn.conf'), callback(tldCountMap), 'domainset');
  await runAgainstSourceFile(path.join(OUTPUT_SURGE_DIR, 'domainset', 'download.conf'), callback(tldCountMap), 'domainset');
  await runAgainstSourceFile(path.join(OUTPUT_SURGE_DIR, 'domainset', 'speedtest.conf'), callback(tldCountMap), 'domainset');
  await runAgainstSourceFile(path.join(OUTPUT_SURGE_DIR, 'domainset', 'reject.conf'), callback(tldCountMap), 'domainset');
  await runAgainstSourceFile(path.join(OUTPUT_SURGE_DIR, 'domainset', 'reject_extra.conf'), callback(tldCountMap), 'domainset');
  await runAgainstSourceFile(path.join(OUTPUT_SURGE_DIR, 'non_ip', 'global.conf'), callback(tldCountMap), 'ruleset');
  await runAgainstSourceFile(path.join(OUTPUT_SURGE_DIR, 'non_ip', 'ai.conf'), callback(tldCountMap), 'ruleset');
  await runAgainstSourceFile(path.join(OUTPUT_SURGE_DIR, 'non_ip', 'microsoft.conf'), callback(tldCountMap), 'ruleset');
  await runAgainstSourceFile(path.join(OUTPUT_SURGE_DIR, 'non_ip', 'my_reject.conf'), callback(tldCountMap), 'ruleset');
  await runAgainstSourceFile(path.join(OUTPUT_SURGE_DIR, 'non_ip', 'my_direct.conf'), callback(tldCountMap), 'ruleset');
  await runAgainstSourceFile(path.join(OUTPUT_SURGE_DIR, 'non_ip', 'my_us.conf'), callback(tldCountMap), 'ruleset');
  await runAgainstSourceFile(path.join(OUTPUT_SURGE_DIR, 'non_ip', 'my_tw.conf'), callback(tldCountMap), 'ruleset');
  await runAgainstSourceFile(path.join(OUTPUT_SURGE_DIR, 'non_ip', 'stream.conf'), callback(tldCountMap), 'ruleset');

  const countArr = Array.from(tldCountMap).sort((a, b) => b[1] - a[1]).filter(([, count]) => count > 20);
  console.table(countArr);
})();
