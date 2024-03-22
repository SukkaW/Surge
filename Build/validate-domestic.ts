import { fetchRemoteTextByLine, readFileByLine } from './lib/fetch-text-by-line';
import { Readable } from 'stream';
import { parse } from 'csv-parse';
import { createTrie } from './lib/trie';
import path from 'path';
import { processLine } from './lib/process-line';

export const parseDomesticList = async () => {
  const set = new Set<string>();
  for await (const line of await fetchRemoteTextByLine('https://raw.githubusercontent.com/felixonmars/dnsmasq-china-list/master/accelerated-domains.china.conf')) {
    if (line.startsWith('server=/') && line.endsWith('/114.114.114.114')) {
      const domain = line.slice(8, -16);
      set.add(domain);
    }
  }

  const trie = createTrie(set);

  const top5000 = new Set<string>();

  const res = await fetch('https://radar.cloudflare.com/charts/LargerTopDomainsTable/attachment?id=1077&top=10000');
  const stream = Readable.fromWeb(res.body!).pipe(parse());
  for await (const [domain] of stream) {
    if (trie.has(domain)) {
      top5000.add(domain);
    }
    console.log({ domain });
  }

  const notIncludedDomestic = new Set<string>(top5000);

  const runAgainstRuleset = async (ruleset: string) => {
    for await (const l of readFileByLine(ruleset)) {
      const line = processLine(l);
      if (!line) continue;
      const [type, domain] = line.split(',');
      if (type === 'DOMAIN-SUFFIX') {
        if (top5000.has(domain)) {
          notIncludedDomestic.delete(domain);
        }
      } else if (type === 'DOMAIN-KEYWORD') {
        for (const d of top5000) {
          if (d.includes(domain)) {
            notIncludedDomestic.delete(d);
          }
        }
      }
    }
  };

  await Promise.all([
    runAgainstRuleset(path.resolve(import.meta.dir, '../List/non_ip/domestic.conf'))
  ]);

  console.log(notIncludedDomestic.size, notIncludedDomestic);
};

if (import.meta.main) {
  parseDomesticList();
}
