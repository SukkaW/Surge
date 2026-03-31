import picocolors from 'picocolors';
import { parse } from 'tldts-experimental';
import { appendArrayInPlaceCurried } from 'foxts/append-array-in-place';

import { dummySpan } from '../trace';
import type { TldTsParsed } from './normalize-domain';

import { loosTldOptWithPrivateDomains } from '../constants/loose-tldts-opt';
import { BLACK_TLD, WHITELIST_MAIN_DOMAINS, leathalKeywords, lowKeywords, sensitiveKeywords } from '../constants/phishing-score-source';
import { PHISHING_DOMAIN_LISTS_EXTRA, PHISHING_HOSTS_EXTRA } from '../constants/reject-data-source';

import { processHostsWithPreload } from './parse-filter/hosts';
import { processDomainListsWithPreload } from './parse-filter/domainlists';

import process from 'node:process';

export function getPhishingDomains(isDebug = false): Promise<string[]> {
  return dummySpan.traceChild('get phishing domains').traceAsyncFn(async (span) => span.traceChildAsync(
    'process phishing domain set',
    async () => {
      const downloads = [
        ...PHISHING_DOMAIN_LISTS_EXTRA.map(entry => processDomainListsWithPreload(...entry)),
        ...PHISHING_HOSTS_EXTRA.map(entry => processHostsWithPreload(...entry))
      ];

      const domainArr: string[] = [];

      const domainGroups = await Promise.all(downloads.map(task => task(dummySpan)));
      domainGroups.forEach(appendArrayInPlaceCurried(domainArr));

      const domainCountMap = new Map<string, number>();
      const domainScoreMap: Record<string, number> = Object.create(null) as Record<string, number>;

      let line: string;
      let tld: string | null;
      let apexDomain: string | null;
      let subdomain: string | null;
      let parsed: TldTsParsed;

      for (let i = 0, len = domainArr.length; i < len; i++) {
        line = domainArr[i];

        parsed = parse(line, loosTldOptWithPrivateDomains);
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
        if (WHITELIST_MAIN_DOMAINS.has(apexDomain)) {
          continue;
        }

        domainCountMap.set(
          apexDomain,
          domainCountMap.has(apexDomain)
            ? domainCountMap.get(apexDomain)! + 1
            : 1
        );

        let score = 0;

        if (apexDomain in domainScoreMap) {
          score = domainScoreMap[apexDomain];
        } else {
          if (BLACK_TLD.has(tld)) {
            score += 3;
          } else if (tld.length > 4) {
            score += 2;
          } else if (tld.length > 5) {
            score += 4;
          }
          if (apexDomain.length >= 18) {
            score += 0.5;
          }
        }

        subdomain = parsed.subdomain;

        if (subdomain) {
          score += calcDomainAbuseScore(subdomain, line);
        }

        domainScoreMap[apexDomain] = score;
      }

      domainCountMap.forEach((count, apexDomain) => {
        const score = domainScoreMap[apexDomain];
        if (
          (score >= 24)
          || (score >= 16 && count >= 7)
          || (score >= 13 && count >= 11)
          || (score >= 5 && count >= 14)
          || (score >= 3 && count >= 21)
          || (score >= 1 && count >= 60)
        ) {
          domainArr.push('.' + apexDomain);
        }
      });

      if (isDebug) {
        console.log({
          v: 1,
          score: domainScoreMap['com-ticketry.world'],
          count: domainCountMap.get('com-ticketry.world'),
          domainArrLen: domainArr.length
        });
      }

      return domainArr;
    }
  ));
}

function calcDomainAbuseScore(subdomain: string, fullDomain: string = subdomain) {
  if (leathalKeywords(fullDomain)) {
    return 100;
  }

  let weight = 0;

  const hitLowKeywords = lowKeywords(fullDomain);
  const sensitiveKeywordsHit = sensitiveKeywords(fullDomain);

  if (sensitiveKeywordsHit) {
    weight += 15;
    if (hitLowKeywords) {
      weight += 10;
    }
  } else if (hitLowKeywords) {
    weight += 2;
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

if (!process.env.JEST_WORKER_ID && require.main === module) {
  getPhishingDomains(true).catch(console.error);
}
