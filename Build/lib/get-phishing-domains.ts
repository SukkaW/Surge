import { getGorhillPublicSuffixPromise } from './get-gorhill-publicsuffix';
import { processDomainLists } from './parse-filter';
import { getSubdomain, getPublicSuffix } from 'tldts-experimental';
import { TTL } from './cache-filesystem';

import type { Span } from '../trace';
import { appendArrayInPlace, appendArrayInPlaceCurried } from './append-array-in-place';
import { PHISHING_DOMAIN_LISTS } from './reject-data-source';

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

const tldtsOpt: Parameters<typeof getSubdomain>[1] = {
  allowPrivateDomains: false,
  extractHostname: false,
  validateHostname: false,
  detectIp: false,
  mixedInputs: false
};

export const getPhishingDomains = (parentSpan: Span) => parentSpan.traceChild('get phishing domains').traceAsyncFn(async (span) => {
  const gorhill = await getGorhillPublicSuffixPromise();

  const domainArr = await span.traceChildAsync('download/parse/merge phishing domains', async (curSpan) => {
    const domainSet: string[] = [];

    (await Promise.all(PHISHING_DOMAIN_LISTS.map(entry => processDomainLists(curSpan, ...entry))))
      .forEach(appendArrayInPlaceCurried(domainSet));

    return domainSet;
  });

  const domainCountMap: Record<string, number> = {};

  span.traceChildSync('process phishing domain set', () => {
    for (let i = 0, len = domainArr.length; i < len; i++) {
      const line = domainArr[i];

      const safeGorhillLine = line[0] === '.' ? line.slice(1) : line;

      const apexDomain = gorhill.getDomain(safeGorhillLine);
      if (!apexDomain) {
        continue;
      }

      const tld = getPublicSuffix(safeGorhillLine, tldtsOpt);
      if (!tld || !BLACK_TLD.has(tld)) continue;

      domainCountMap[apexDomain] ||= 0;
      domainCountMap[apexDomain] += calcDomainAbuseScore(line);
    }
  });

  span.traceChildSync('get final phishing results', () => {
    for (const domain in domainCountMap) {
      if (domainCountMap[domain] >= 8) {
        domainArr.push(`.${domain}`);
      }
    }
  });

  return domainArr;
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

  const subdomain = getSubdomain(line, tldtsOpt);

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
