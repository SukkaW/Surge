import { fetchRemoteTextByLine } from './fetch-text-by-line';
import { sortDomains } from './stable-sort-domain';

import { bench, group, run } from 'mitata';

(async () => {
  const data = await Array.fromAsync(await fetchRemoteTextByLine('https://osint.digitalside.it/Threat-Intel/lists/latestdomains.txt', true));

  group(() => {
    bench('sortDomains', () => sortDomains(data));
  });

  run();
})();
