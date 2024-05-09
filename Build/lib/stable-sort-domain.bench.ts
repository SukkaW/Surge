import { fetchRemoteTextByLine } from './fetch-text-by-line';
import { getGorhillPublicSuffixPromise } from './get-gorhill-publicsuffix';
import { processLineFromReadline } from './process-line';
import { sortDomains } from './stable-sort-domain';

import { bench, group, run } from 'mitata';

(async () => {
  const data = await processLineFromReadline(await fetchRemoteTextByLine('https://osint.digitalside.it/Threat-Intel/lists/latestdomains.txt'));
  const gorhill = await getGorhillPublicSuffixPromise();

  group('sortDomains', () => {
    bench('run', () => sortDomains(data, gorhill));
  });

  run();
})();
