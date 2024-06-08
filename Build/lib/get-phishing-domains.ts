import { processDomainLists } from './parse-filter';
import { parse } from 'tldts-experimental';

import type { Span } from '../trace';
import { appendArrayInPlaceCurried } from './append-array-in-place';
import { PHISHING_DOMAIN_LISTS } from './reject-data-source';
import { looseTldtsOpt } from '../constants/loose-tldts-opt';
import picocolors from 'picocolors';

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
  'digital',
  'download',
  'faith',
  'fit',
  'fun',
  'ga',
  'gd',
  'gives',
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

export const WHITELIST_MAIN_DOMAINS = new Set([
  'w3s.link', // ipfs gateway
  'dweb.link', // ipfs gateway
  'nftstorage.link', // ipfs gateway
  'fleek.cool', // ipfs gateway
  'business.site', // Drag'n'Drop site building platform
  'page.link', // Firebase URL Shortener
  'notion.site'
]);

export const getPhishingDomains = (parentSpan: Span) => parentSpan.traceChild('get phishing domains').traceAsyncFn(async (span) => {
  const domainArr = await span.traceChildAsync('download/parse/merge phishing domains', async (curSpan) => {
    const domainArr: string[] = [];

    (await Promise.all(PHISHING_DOMAIN_LISTS.map(entry => processDomainLists(curSpan, ...entry))))
      .forEach(appendArrayInPlaceCurried(domainArr));

    return domainArr;
  });

  const domainCountMap: Record<string, number> = {};

  span.traceChildSync('process phishing domain set', () => {
    for (let i = 0, len = domainArr.length; i < len; i++) {
      const line = domainArr[i];

      const {
        publicSuffix: tld,
        domain: apexDomain,
        subdomain
      } = parse(line, looseTldtsOpt);

      if (!tld) {
        console.log(picocolors.yellow('[phishing domains] E0001'), 'missing tld', { line, tld });
        continue;
      }
      if (!apexDomain) {
        console.log(picocolors.yellow('[phishing domains] E0002'), 'missing domain', { line, apexDomain });
        continue;
      }

      if (!BLACK_TLD.has(tld) && tld.length < 7) continue;

      domainCountMap[apexDomain] ||= 0;
      domainCountMap[apexDomain] += calcDomainAbuseScore(line, subdomain);
    }
  });

  for (const domain in domainCountMap) {
    if (domainCountMap[domain] >= 8 && !WHITELIST_MAIN_DOMAINS.has(domain)) {
      domainArr.push(`.${domain}`);
    }
  }

  return domainArr;
});

export function calcDomainAbuseScore(line: string, subdomain: string | null) {
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
  }
  if (line.includes('.customer')) {
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
