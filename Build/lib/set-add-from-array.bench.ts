import { fetchRemoteTextByLine } from './fetch-text-by-line';
import { processLineFromReadline } from './process-line';

import { bench, group, run } from 'mitata';

(async () => {
  const data = await processLineFromReadline(await fetchRemoteTextByLine('https://osint.digitalside.it/Threat-Intel/lists/latestdomains.txt'));

  group('setAddFromArray', () => {
    bench('run', () => {
      const set = new Set(['1', '2', '1', '3', 'skk.moe']);
      for (let i = 0, len = data.length; i < len; i++) {
        set.add(data[i]);
      }
    });
  });
  group('setAddFromArray', () => {
    bench('run', () => {
      const set = new Set(['1', '2', '1', '3', 'skk.moe']);
      // eslint-disable-next-line @typescript-eslint/unbound-method -- thisArg is passed
      data.forEach(set.add, set);
    });
  });

  run();
})();
