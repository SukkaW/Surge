import { fetchRemoteTextByLine, readFileByLine } from './lib/fetch-text-by-line';
import { parse } from 'csv-parse/sync';
import { createTrie } from './lib/trie';
import path from 'node:path';
import { processLine } from './lib/process-line';
import { extractDomainsFromFelixDnsmasq } from './lib/parse-dnsmasq';
import { SOURCE_DIR } from './constants/dir';

export const parseDomesticList = async () => {
  const set = new Set<string>();
  for await (const line of await fetchRemoteTextByLine('https://raw.githubusercontent.com/felixonmars/dnsmasq-china-list/master/accelerated-domains.china.conf')) {
    const domain = extractDomainsFromFelixDnsmasq(line);
    if (domain) {
      set.add(domain);
    }
  }

  const trie = createTrie(set);

  const top5000 = new Set<string>();

  const res = await (await fetch('https://radar.cloudflare.com/charts/LargerTopDomainsTable/attachment?id=1077&top=10000', {
    headers: {
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'accept-language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7,zh-TW;q=0.6,es;q=0.5',
      'sec-ch-ua': '"Google Chrome";v="123", "Not:A-Brand";v="8", "Chromium";v="123"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"macOS"',
      'sec-fetch-dest': 'document',
      'sec-fetch-mode': 'navigate',
      'sec-fetch-site': 'none',
      'sec-fetch-user': '?1',
      'upgrade-insecure-requests': '1'
    }
  })).text();
  const stream = parse(res);
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

  // await Promise.all([
  await runAgainstRuleset(path.resolve(SOURCE_DIR, 'non_ip/domestic.conf'));
  // ]);

  console.log(notIncludedDomestic.size, notIncludedDomestic);
};
