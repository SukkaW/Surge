import { processDomainLists } from './parse-filter';
import * as tldts from 'tldts-experimental';

import { dummySpan } from '../trace';
import type { Span } from '../trace';
import { appendArrayInPlaceCurried } from './append-array-in-place';
import { PHISHING_DOMAIN_LISTS_EXTRA } from '../constants/reject-data-source';
import { loosTldOptWithPrivateDomains } from '../constants/loose-tldts-opt';
import picocolors from 'picocolors';
import createKeywordFilter from './aho-corasick';
import { createCacheKey, deserializeArray, fsFetchCache, serializeArray } from './cache-filesystem';
import { fastStringArrayJoin } from './misc';

import { sha256 } from 'hash-wasm';

const BLACK_TLD = new Set([
  'accountant',
  'autos',
  'bar',
  'beauty',
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
  'lol',
  'ltd',
  'me',
  'men',
  'ml',
  'mobi',
  'mom',
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
  'surf',
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

const WHITELIST_MAIN_DOMAINS = new Set([
  // 'w3s.link', // ipfs gateway
  // 'dweb.link', // ipfs gateway
  // 'nftstorage.link', // ipfs gateway
  'fleek.cool', // ipfs gateway
  'business.site', // Drag'n'Drop site building platform
  'page.link', // Firebase URL Shortener
  // 'notion.site',
  // 'vercel.app',
  'gitbook.io'
]);

const sensitiveKeywords = createKeywordFilter([
  '-roblox',
  '.amazon-',
  '-amazon',
  'fb-com',
  'facebook.',
  'facebook-',
  'facebook-com',
  '.facebook',
  '-facebook',
  'coinbase',
  'metamask-',
  '-metamask',
  'virus-',
  'icloud-',
  'apple-',
  'www.apple',
  '-coinbase',
  'coinbase-',
  'lcloud.',
  'lcloud-',
  'booking-com',
  'booking.com-',
  'booking-eu',
  'vinted-cz',
  'inpost-pl',
  'login.microsoft',
  'login-microsoft'
]);
const lowKeywords = createKeywordFilter([
  '-co-jp',
  'customer.',
  'customer-',
  '.www-',
  'instagram',
  'microsoft',
  'passwordreset'
]);

const cacheKey = createCacheKey(__filename);

export const getPhishingDomains = (parentSpan: Span) => parentSpan.traceChild('get phishing domains').traceAsyncFn(async (span) => {
  const domainArr = await span.traceChildAsync('download/parse/merge phishing domains', async (curSpan) => {
    const domainArr: string[] = [];

    (await Promise.all(PHISHING_DOMAIN_LISTS_EXTRA.map(entry => processDomainLists(curSpan, ...entry, cacheKey))))
      .forEach(appendArrayInPlaceCurried(domainArr));

    return domainArr;
  });

  return span.traceChildAsync(
    'process phishing domain set',
    () => processPhihsingDomains(domainArr)
  );
});

async function processPhihsingDomains(domainArr: string[]) {
  const hash = await sha256(fastStringArrayJoin(domainArr, '|'));
  return fsFetchCache.apply(
    cacheKey('processPhihsingDomains|' + hash),
    () => {
      const domainCountMap: Record<string, number> = {};
      const domainScoreMap: Record<string, number> = {};

      for (let i = 0, len = domainArr.length; i < len; i++) {
        const line = domainArr[i];

        const {
          publicSuffix: tld,
          domain: apexDomain,
          subdomain,
          isPrivate
        } = tldts.parse(line, loosTldOptWithPrivateDomains);

        if (isPrivate) {
          continue;
        }

        if (!tld) {
          console.log(picocolors.yellow('[phishing domains] E0001'), 'missing tld', { line, tld });
          continue;
        }
        if (!apexDomain) {
          console.log(picocolors.yellow('[phishing domains] E0002'), 'missing domain', { line, apexDomain });
          continue;
        }

        domainCountMap[apexDomain] ||= 0;
        domainCountMap[apexDomain] += 1;

        if (!(apexDomain in domainScoreMap)) {
          domainScoreMap[apexDomain] = 0;
          if (BLACK_TLD.has(tld)) {
            domainScoreMap[apexDomain] += 4;
          } else if (tld.length > 6) {
            domainScoreMap[apexDomain] += 2;
          }
        }
        if (
          subdomain
          && !WHITELIST_MAIN_DOMAINS.has(apexDomain)
        ) {
          domainScoreMap[apexDomain] += calcDomainAbuseScore(subdomain);
        }
      }

      for (const apexDomain in domainCountMap) {
        if (
          // !WHITELIST_MAIN_DOMAINS.has(apexDomain)
          domainScoreMap[apexDomain] >= 12
          || (domainScoreMap[apexDomain] >= 5 && domainCountMap[apexDomain] >= 4)
        ) {
          domainArr.push('.' + apexDomain);
        }
      }

      return Promise.resolve(domainArr);
    },
    {
      ttl: 2 * 86400 * 1000,
      serializer: serializeArray,
      deserializer: deserializeArray,
      incrementTtlWhenHit: true
    }
  );
}

export function calcDomainAbuseScore(subdomain: string) {
  let weight = 0;

  const hitLowKeywords = lowKeywords(subdomain);
  const sensitiveKeywordsHit = sensitiveKeywords(subdomain);

  if (sensitiveKeywordsHit) {
    weight += 8;
    if (hitLowKeywords) {
      weight += 4;
    }
  } else if (hitLowKeywords) {
    weight += 1;
  }

  const subdomainLength = subdomain.length;

  if (subdomainLength > 4) {
    weight += 0.5;
    if (subdomainLength > 10) {
      weight += 0.5;
      if (subdomainLength > 20) {
        weight += 1;
        if (subdomainLength > 30) {
          weight += 2;
          if (subdomainLength > 40) {
            weight += 4;
          }
        }
      }
    }

    if (subdomain.startsWith('www.')) {
      weight += 4;
    } else if (subdomain.slice(1).includes('.')) {
      weight += 1;
      if (subdomain.includes('www.')) {
        weight += 4;
      }
    }
  }

  return weight;
}

if (require.main === module) {
  getPhishingDomains(dummySpan)
    .catch(console.error);
}
