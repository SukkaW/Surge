import { fetchRemoteTextByLine } from './fetch-text-by-line';

import { bench, group, run } from 'mitata';

(async () => {
  const data = await Array.fromAsync(await fetchRemoteTextByLine('https://osint.digitalside.it/Threat-Intel/lists/latestdomains.txt', true));

  group(() => {
    bench('setAddFromArray', () => {
      const set = new Set(['1', '2', '1', '3', 'skk.moe']);
      for (let i = 0, len = data.length; i < len; i++) {
        set.add(data[i]);
      }
    });
  });
  group(() => {
    bench('', () => {
      const set = new Set(['1', '2', '1', '3', 'skk.moe']);
      // eslint-disable-next-line @typescript-eslint/unbound-method -- thisArg is passed
      data.forEach(set.add, set);
    });
  });

  run();
})();
