import { getGorhillPublicSuffixPromise } from './get-gorhill-publicsuffix';
import { processDomainLists } from './parse-filter';
import * as tldts from 'tldts';
import { createTrie } from './trie';
import { TTL } from './cache-filesystem';

import { add as SetAdd } from 'mnemonist/set';
import type { Span } from '../trace';

const WHITELIST_DOMAIN = [
  'w3s.link',
  'dweb.link',
  'nftstorage.link',
  'square.site',
  'business.site',
  'page.link', // Firebase URL Shortener
  'fleek.cool',
  'notion.site'
];
const BLACK_TLD = new Set([
  'accountant',
  'autos',
  'bar',
  'bid',
  'biz',
  'bond',
  'business',
  'buzz',
  'cc',
  'cf',
  'cfd',
  'click',
  'cloud',
  'club',
  'cn',
  'codes',
  'co.uk',
  'co.in',
  'com.br',
  'com.cn',
  'com.pl',
  'com.vn',
  'cool',
  'cricket',
  'cyou',
  'date',
  'download',
  'faith',
  'fit',
  'fun',
  'ga',
  'gd',
  'gq',
  'group',
  'host',
  'icu',
  'id',
  'info',
  'ink',
  'life',
  'live',
  'link',
  'loan',
  'ltd',
  'men',
  'ml',
  'mobi',
  'net.pl',
  'one',
  'online',
  'party',
  'pro',
  'pl',
  'pw',
  'racing',
  'rest',
  'review',
  'rf.gd',
  'sa.com',
  'sbs',
  'science',
  'shop',
  'site',
  'space',
  'store',
  'stream',
  'tech',
  'tk',
  'tokyo',
  'top',
  'trade',
  'vip',
  'vn',
  'webcam',
  'website',
  'win',
  'xyz',
  'za.com',
  'lat',
  'design'
]);

export const getPhishingDomains = (parentSpan: Span) => parentSpan.traceChild('get phishing domains').traceAsyncFn(async (span) => {
  const gorhill = await getGorhillPublicSuffixPromise();

  const domainSet = await span.traceChildAsync('download/parse/merge phishing domains', async (curSpan) => {
    const [domainSet, domainSet2] = await Promise.all([
      processDomainLists(curSpan, 'https://curbengh.github.io/phishing-filter/phishing-filter-domains.txt', true, TTL.THREE_HOURS()),
      processDomainLists(curSpan, 'https://phishing.army/download/phishing_army_blocklist.txt', true, TTL.THREE_HOURS())
    ]);

    SetAdd(domainSet, domainSet2);

    return domainSet;
  });

  span.traceChildSync('whitelisting phishing domains', (curSpan) => {
    const trieForRemovingWhiteListed = curSpan.traceChildSync('create trie for whitelisting', () => createTrie(domainSet));

    return curSpan.traceChild('delete whitelisted from domainset').traceSyncFn(() => {
      for (let i = 0, len = WHITELIST_DOMAIN.length; i < len; i++) {
        const white = WHITELIST_DOMAIN[i];
        domainSet.delete(white);
        domainSet.delete(`.${white}`);

        trieForRemovingWhiteListed.substractSetInPlaceFromFound(`.${white}`, domainSet);
      }
    });
  });

  const domainCountMap: Record<string, number> = {};

  span.traceChildSync('process phishing domain set', () => {
    const domainArr = Array.from(domainSet);

    for (let i = 0, len = domainArr.length; i < len; i++) {
      const line = domainArr[i];

      const safeGorhillLine = line[0] === '.' ? line.slice(1) : line;

      const apexDomain = gorhill.getDomain(safeGorhillLine);
      if (!apexDomain) {
        console.log({ line });
        continue;
      }

      const tld = gorhill.getPublicSuffix(safeGorhillLine);
      if (!tld || !BLACK_TLD.has(tld)) continue;

      domainCountMap[apexDomain] ||= 0;
      domainCountMap[apexDomain] += calcDomainAbuseScore(line);
    }
  });

  const results = span.traceChildSync('get final phishing results', () => {
    const res: string[] = [];
    for (const domain in domainCountMap) {
      if (domainCountMap[domain] >= 8) {
        res.push(`.${domain}`);
      }
    }
    return res;
  });

  return [results, domainSet] as const;
});

export function calcDomainAbuseScore(line: string) {
  let weight = 1;

  const isPhishingDomainMockingCoJp = line.includes('-co-jp');
  if (isPhishingDomainMockingCoJp) {
    weight += 0.5;
  }

  if (line.startsWith('.amaz')) {
    weight += 0.5;

    if (line.startsWith('.amazon-')) {
      weight += 4.5;
    }
    if (isPhishingDomainMockingCoJp) {
      weight += 4;
    }
  } else if (line.includes('.customer')) {
    weight += 0.25;
  }

  const lineLen = line.length;

  if (lineLen > 19) {
    // Add more weight if the domain is long enough
    if (lineLen > 44) {
      weight += 3.5;
    } else if (lineLen > 34) {
      weight += 2.5;
    } else if (lineLen > 29) {
      weight += 1.5;
    } else if (lineLen > 24) {
      weight += 0.75;
    } else {
      weight += 0.25;
    }
  }

  const subdomain = tldts.getSubdomain(line, { detectIp: false });

  if (subdomain) {
    if (subdomain.slice(1).includes('.')) {
      weight += 1;
    }
    if (subdomain.length > 40) {
      weight += 3;
    } else if (subdomain.length > 30) {
      weight += 1.5;
    } else if (subdomain.length > 20) {
      weight += 1;
    } else if (subdomain.length > 10) {
      weight += 0.1;
    }
  }

  return weight;
}
