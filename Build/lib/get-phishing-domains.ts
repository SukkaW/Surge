import fsp from 'fs/promises';
import path from 'path';
import { getGorhillPublicSuffixPromise } from './get-gorhill-publicsuffix';
import { processHosts } from './parse-filter';
import { traceAsync, traceSync } from './trace-runner';
import * as tldts from 'tldts';
import { createTrie } from './trie';
import { createCachedGorhillGetDomain } from './cached-tld-parse';
import { processLine } from './process-line';

const WHITELIST_DOMAIN = new Set([
  'w3s.link',
  'dweb.link',
  'nftstorage.link',
  'square.site',
  'business.site',
  'page.link', // Firebase URL Shortener
  'fleek.cool',
  'notion.site'
]);
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
  'com.cn',
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

export const getPhishingDomains = () => traceAsync('get phishing domains', async () => {
  const [domainSet, gorhill] = await Promise.all([
    processHosts('https://curbengh.github.io/phishing-filter/phishing-filter-hosts.txt', true, true),
    // processDomainLists('https://phishing.army/download/phishing_army_blocklist.txt', true),
    // processFilterRules(
    //   'https://curbengh.github.io/phishing-filter/phishing-filter-agh.txt',
    //   [
    //     'https://phishing-filter.pages.dev/phishing-filter-agh.txt'
    //     // Prefer mirror, since malware-filter.gitlab.io has not been updated for a while
    //     // 'https://malware-filter.gitlab.io/malware-filter/phishing-filter-agh.txt'
    //   ]
    // ),
    getGorhillPublicSuffixPromise()
  ]);

  traceSync.skip('* whitelisting phishing domains', () => {
    const trieForRemovingWhiteListed = createTrie(domainSet);
    WHITELIST_DOMAIN.forEach(white => {
      trieForRemovingWhiteListed.find(`.${white}`, false).forEach(f => domainSet.delete(f));
      // if (trieForRemovingWhiteListed.has(white)) {
      domainSet.delete(white);
      // }
    });
  });

  const domainCountMap: Record<string, number> = {};
  const getDomain = createCachedGorhillGetDomain(gorhill);

  traceSync.skip('* process phishing domain set', () => {
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

  const results = traceSync.skip('* get final phishing results', () => Object.entries(domainCountMap)
    .filter(([, count]) => count >= 5)
    .map(([apexDomain]) => apexDomain));

  return [results, domainSet] as const;
});
