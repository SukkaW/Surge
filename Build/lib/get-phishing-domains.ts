import { getGorhillPublicSuffixPromise } from './get-gorhill-publicsuffix';
import { processDomainLists, processHosts } from './parse-filter';
import { traceAsync, traceSync } from './trace-runner';
import * as tldts from 'tldts';
import { createTrie } from './trie';
import { createCachedGorhillGetDomain } from './cached-tld-parse';
import { processLine } from './process-line';
import { TTL } from './cache-filesystem';
import { isCI } from 'ci-info';

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
  'autos',
  'bar',
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
  'cyou',
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
  'ltd',
  'ml',
  'mobi',
  'net.pl',
  'one',
  'online',
  'pro',
  'pl',
  'pw',
  'rest',
  'rf.gd',
  'sa.com',
  'sbs',
  'shop',
  'site',
  'space',
  'store',
  'tech',
  'tk',
  'tokyo',
  'top',
  'vip',
  'vn',
  'website',
  'win',
  'xyz',
  'za.com'
]);

export const getPhishingDomains = (parentSpan: Span) => parentSpan.traceChild('get phishing domains').traceAsyncFn(async (span) => {
  const [domainSet, domainSet2, gorhill] = await Promise.all([
    processDomainLists(span, 'https://curbengh.github.io/phishing-filter/phishing-filter-domains.txt', true, TTL.THREE_HOURS()),
    isCI
      ? processDomainLists(span, 'https://phishing.army/download/phishing_army_blocklist.txt', true, TTL.THREE_HOURS())
      : null,
    getGorhillPublicSuffixPromise()
  ]);
  if (domainSet2) {
    SetAdd(domainSet, domainSet2);
  }

  span.traceChild('whitelisting phishing domains').traceSyncFn(() => {
    const trieForRemovingWhiteListed = createTrie(domainSet);

    const needToBeWhite = WHITELIST_DOMAIN.flatMap(white => {
      const found = trieForRemovingWhiteListed.find(`.${white}`, true);
      found.push(white);
      return found;
    });

    for (let i = 0, len = needToBeWhite.length; i < len; i++) {
      domainSet.delete(needToBeWhite[i]);
    }
  });

  const domainCountMap: Record<string, number> = {};
  const getDomain = createCachedGorhillGetDomain(gorhill);

  span.traceChild('process phishing domain set').traceSyncFn(() => {
    const domainArr = Array.from(domainSet);

    for (let i = 0, len = domainArr.length; i < len; i++) {
      const line = processLine(domainArr[i]);
      if (!line) continue;

      const apexDomain = getDomain(line);
      if (!apexDomain) continue;

      domainCountMap[apexDomain] ||= 0;

      const isPhishingDomainMockingCoJp = line.includes('-co-jp');
      if (isPhishingDomainMockingCoJp) {
        domainCountMap[apexDomain] += 0.5;
      }

      if (line.startsWith('.amaz')) {
        domainCountMap[apexDomain] += 0.5;

        if (line.startsWith('.amazon-')) {
          domainCountMap[apexDomain] += 4.5;
        }
        if (isPhishingDomainMockingCoJp) {
          domainCountMap[apexDomain] += 4;
        }
      } else if (line.startsWith('.customer')) {
        domainCountMap[apexDomain] += 0.25;
      }

      const tld = gorhill.getPublicSuffix(line[0] === '.' ? line.slice(1) : line);
      if (!tld || !BLACK_TLD.has(tld)) continue;

      domainCountMap[apexDomain] += 1;

      const lineLen = line.length;

      if (lineLen > 19) {
        // Add more weight if the domain is long enough
        if (lineLen > 44) {
          domainCountMap[apexDomain] += 3.5;
        } else if (lineLen > 34) {
          domainCountMap[apexDomain] += 2.5;
        } else if (lineLen > 29) {
          domainCountMap[apexDomain] += 1.5;
        } else if (lineLen > 24) {
          domainCountMap[apexDomain] += 0.75;
        } else {
          domainCountMap[apexDomain] += 0.25;
        }

        if (domainCountMap[apexDomain] < 5) {
          const subdomain = tldts.getSubdomain(line, { detectIp: false });
          if (subdomain?.includes('.')) {
            domainCountMap[apexDomain] += 1.5;
          }
        }
      }
    }
  });

  const results = span.traceChild('get final phishing results').traceSyncFn(() => Object.entries(domainCountMap)
    .filter(([, count]) => count >= 5)
    .map(([apexDomain]) => apexDomain));

  return [results, domainSet] as const;
});
