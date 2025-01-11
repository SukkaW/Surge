import { fetchRemoteTextByLine } from './lib/fetch-text-by-line';
import tldts from 'tldts';

(async () => {
  const lines = await Array.fromAsync(await fetchRemoteTextByLine('https://raw.githubusercontent.com/durablenapkin/block/master/luminati.txt', true));

  const set = new Set<string>();

  lines.forEach((line) => {
    const apexDomain = tldts.getDomain(line.slice(8));
    if (apexDomain) {
      set.add(apexDomain);
    }
  });

  console.log(Array.from(set).map(line => '.' + line).join('\n'));
})();
