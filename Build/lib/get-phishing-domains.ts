import { processHostsWithPreload } from './parse-filter/hosts';
import { processDomainListsWithPreload } from './parse-filter/domainlists';

import * as tldts from 'tldts-experimental';

import { dummySpan, printTraceResult } from '../trace';
import type { Span } from '../trace';
import { appendArrayInPlaceCurried } from './append-array-in-place';
import { DEBUG_DOMAIN_TO_FIND, PHISHING_DOMAIN_LISTS_EXTRA, PHISHING_HOSTS_EXTRA } from '../constants/reject-data-source';
import { loosTldOptWithPrivateDomains } from '../constants/loose-tldts-opt';
import picocolors from 'picocolors';
import { createRetrieKeywordFilter as createKeywordFilter } from 'foxts/retrie';
import { deserializeArray, serializeArray } from './cache-filesystem';
import { cache } from './fs-memo';
import { isCI } from 'ci-info';

const BLACK_TLD = new Set([
  'accountant', 'art', 'autos',
  'bar', 'beauty', 'bid', 'bio', 'biz', 'bond', 'business', 'buzz',
  'cc', 'cf', 'cfd', 'click', 'cloud', 'club', 'cn', 'codes',
  'co.uk', 'co.in', 'com.br', 'com.cn', 'com.pl', 'com.vn',
  'cool', 'cricket', 'cyou',
  'date', 'design', 'digital', 'download',
  'faith', 'fit', 'fun',
  'ga', 'gd', 'gives', 'gq', 'group', 'host',
  'icu', 'id', 'info', 'ink',
  'lat', 'life', 'live', 'link', 'loan', 'lol', 'ltd',
  'me', 'men', 'ml', 'mobi', 'mom', 'monster',
  'net.pl',
  'one', 'online',
  'party', 'pro', 'pl', 'pw',
  'racing', 'rest', 'review', 'rf.gd',
  'sa.com', 'sbs', 'science', 'shop', 'site', 'skin', 'space', 'store', 'stream', 'su', 'surf',
  'tech', 'tk', 'tokyo', 'top', 'trade',
  'vip', 'vn',
  'webcam', 'website', 'win',
  'xyz',
  'za.com'
]);

const WHITELIST_MAIN_DOMAINS = new Set([
  // 'w3s.link', // ipfs gateway
  // 'dweb.link', // ipfs gateway
  // 'nftstorage.link', // ipfs gateway
  'fleek.cool', // ipfs gateway
  'flk-ipfs.xyz', // ipfs gateway
  'business.site', // Drag'n'Drop site building platform
  'page.link', // Firebase URL Shortener
  // 'notion.site',
  // 'vercel.app',
  'gitbook.io',
  'zendesk.com',
  'ipfs.eth.aragon.network',
  'wordpress.com'
]);

const leathalKeywords = createKeywordFilter([
  'vinted-',
  'inpost-pl',
  'vlnted-'
]);

const sensitiveKeywords = createKeywordFilter([
  '.amazon-',
  '-amazon',
  'fb-com',
  'facebook-com',
  '-facebook',
  'facebook-',
  'focebaak',
  '.facebook.',
  'metamask',
  'www.apple',
  '-coinbase',
  'coinbase-',
  'booking-com',
  'booking.com-',
  'booking-eu',
  'vinted-',
  'inpost-pl',
  'login.microsoft',
  'login-microsoft',
  'microsoftonline',
  'google.com-',
  'minecraft',
  'staemco',
  'oferta'
]);
const lowKeywords = createKeywordFilter([
  'transactions-',
  'payment',
  'wallet',
  '-transactions',
  '-faceb', // facebook fake
  '.faceb', // facebook fake
  'facebook',
  'virus-',
  'icloud-',
  'apple-',
  '-roblox',
  '-co-jp',
  'customer.',
  'customer-',
  '.www-',
  '.www.',
  '.www2',
  'instagram',
  'microsof',
  'passwordreset',
  '.google-',
  'recover',
  'banking'
]);

const processPhihsingDomains = cache(function processPhihsingDomains(domainArr: string[]): string[] {
  const domainCountMap = new Map<string, number>();
  const domainScoreMap: Record<string, number> = {};

  let line = '';
  let tld: string | null = '';
  let apexDomain: string | null = '';
  let subdomain: string | null = '';

  // const set = new Set<string>();
  // let duplicateCount = 0;

  for (let i = 0, len = domainArr.length; i < len; i++) {
    line = domainArr[i];

    // if (set.has(line)) {
    //   duplicateCount++;
    // } else {
    //   set.add(line);
    // }

    const parsed = tldts.parse(line, loosTldOptWithPrivateDomains);
    if (parsed.isPrivate) {
      continue;
    }

    tld = parsed.publicSuffix;
    apexDomain = parsed.domain;

    if (!tld) {
      console.log(picocolors.yellow('[phishing domains] E0001'), 'missing tld', { line, tld });
      continue;
    }
    if (!apexDomain) {
      console.log(picocolors.yellow('[phishing domains] E0002'), 'missing domain', { line, apexDomain });
      continue;
    }

    domainCountMap.set(
      apexDomain,
      domainCountMap.has(apexDomain)
        ? domainCountMap.get(apexDomain)! + 1
        : 1
    );

    if (!(apexDomain in domainScoreMap)) {
      domainScoreMap[apexDomain] = 0;
      if (BLACK_TLD.has(tld)) {
        domainScoreMap[apexDomain] += 3;
      } else if (tld.length > 6) {
        domainScoreMap[apexDomain] += 2;
      }
      if (apexDomain.length >= 18) {
        domainScoreMap[apexDomain] += 0.5;
      }
    }

    subdomain = parsed.subdomain;

    if (
      subdomain
      && !WHITELIST_MAIN_DOMAINS.has(apexDomain)
    ) {
      domainScoreMap[apexDomain] += calcDomainAbuseScore(subdomain, line);
    }
  }

  domainCountMap.forEach((count, apexDomain) => {
    if (
      // !WHITELIST_MAIN_DOMAINS.has(apexDomain)
      (domainScoreMap[apexDomain] >= 24)
      || (domainScoreMap[apexDomain] >= 16 && count >= 7)
      || (domainScoreMap[apexDomain] >= 13 && count >= 11)
      || (domainScoreMap[apexDomain] >= 5 && count >= 14)
      || (domainScoreMap[apexDomain] >= 3 && count >= 21)
      || (domainScoreMap[apexDomain] >= 1 && count >= 60)
    ) {
      domainArr.push('.' + apexDomain);
    }
  });

  // console.log({
  //   score: domainScoreMap['awicksin.com'],
  //   count: domainCountMap.get('awicksin.com')
  // });

  // console.log({ duplicateCount, domainArrLen: domainArr.length });

  return domainArr;
}, {
  serializer: serializeArray,
  deserializer: deserializeArray,
  temporaryBypass: !isCI || DEBUG_DOMAIN_TO_FIND !== null
});

const downloads = [
  ...PHISHING_DOMAIN_LISTS_EXTRA.map(entry => processDomainListsWithPreload(...entry, true)),
  ...PHISHING_HOSTS_EXTRA.map(entry => processHostsWithPreload(...entry))
];

export function getPhishingDomains(parentSpan: Span) {
  return parentSpan.traceChild('get phishing domains').traceAsyncFn(async (span) => {
    const domainArr = await span.traceChildAsync('download/parse/merge phishing domains', async (curSpan) => {
      const domainArr: string[] = [];

      const domainGroups = await Promise.all(downloads.map(task => task(curSpan)));
      domainGroups.forEach(appendArrayInPlaceCurried(domainArr));

      return domainArr;
    });

    return span.traceChildAsync(
      'process phishing domain set',
      () => processPhihsingDomains(domainArr)
    );
  });
}

export function calcDomainAbuseScore(subdomain: string, fullDomain: string = subdomain) {
  if (leathalKeywords(fullDomain)) {
    return 100;
  }

  let weight = 0;

  const hitLowKeywords = lowKeywords(fullDomain);
  const sensitiveKeywordsHit = sensitiveKeywords(fullDomain);

  if (sensitiveKeywordsHit) {
    weight += 10;
    if (hitLowKeywords) {
      weight += 6;
    }
  } else if (hitLowKeywords) {
    weight += 1.7;
  }

  const subdomainLength = subdomain.length;

  if (subdomainLength > 6) {
    weight += 0.015;

    if (subdomainLength > 13) {
      weight += 0.2;
      if (subdomainLength > 20) {
        weight += 1;
        if (subdomainLength > 30) {
          weight += 5;
          if (subdomainLength > 40) {
            weight += 10;
          }
        }
      }

      if (subdomain.indexOf('.', 1) > 1) {
        weight += 1;
      }
    }
  }

  return weight;
}

if (require.main === module) {
  getPhishingDomains(dummySpan)
    .catch(console.error)
    .finally(() => {
      dummySpan.stop();
      printTraceResult(dummySpan.traceResult);
    });
}
