import { fetchRemoteTextByLine } from './fetch-text-by-line';
import { processLine } from './process-line';

import { bench, run } from 'mitata';

(async () => {
  const data = await Array.fromAsync(await fetchRemoteTextByLine('https://filters.adtidy.org/extension/ublock/filters/3_optimized.txt', false));

  bench('processLine', () => data.forEach(processLine));

  run();
})();
