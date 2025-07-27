import Worktank from 'worktank';

import { dummySpan, printTraceResult } from '../trace';
import type { Span } from '../trace';
import type { TldTsParsed } from './normalize-domain';

const pool = new Worktank({
  pool: {
    name: 'process-phishing-domains',
    size: 1
  },
  worker: {
    autoAbort: 20000, // The maximum number of milliseconds to wait for the result from the worker, if exceeded the worker is terminated and the execution promise rejects
    autoInstantiate: true,
    autoTerminate: 30000, // The interval of milliseconds at which to check if the pool can be automatically terminated, to free up resources, workers will be spawned up again if needed
    env: {},
    methods: {
      // eslint-disable-next-line object-shorthand -- workertank
      getPhishingDomains: async function (
        importMetaUrl: string,
        /** require.main === module */ isDebug = false
      ): Promise<string[]> {
      // TODO: createRequire is a temporary workaround for https://github.com/nodejs/node/issues/51956
        const { default: module } = await import('node:module');
        const __require = module.createRequire(importMetaUrl);

        const picocolors = __require('picocolors') as typeof import('picocolors');
        const tldts = __require('tldts-experimental') as typeof import('tldts-experimental');

        const { appendArrayInPlaceCurried } = __require('foxts/append-array-in-place') as typeof import('foxts/append-array-in-place');

        const { loosTldOptWithPrivateDomains } = __require('../constants/loose-tldts-opt') as typeof import('../constants/loose-tldts-opt');
        const { BLACK_TLD, WHITELIST_MAIN_DOMAINS, leathalKeywords, lowKeywords, sensitiveKeywords } = __require('../constants/phishing-score-source') as typeof import('../constants/phishing-score-source');
        const { PHISHING_DOMAIN_LISTS_EXTRA, PHISHING_HOSTS_EXTRA } = __require('../constants/reject-data-source') as typeof import('../constants/reject-data-source');
        const { dummySpan } = __require('../trace') as typeof import('../trace');
        const NullPrototypeObject = __require('null-prototype-object') as typeof import('null-prototype-object');

        const { processHostsWithPreload } = __require('./parse-filter/hosts') as typeof import('./parse-filter/hosts');
        const { processDomainListsWithPreload } = __require('./parse-filter/domainlists') as typeof import('./parse-filter/domainlists');

        const downloads = [
          ...PHISHING_DOMAIN_LISTS_EXTRA.map(entry => processDomainListsWithPreload(...entry)),
          ...PHISHING_HOSTS_EXTRA.map(entry => processHostsWithPreload(...entry))
        ];

        const domainArr: string[] = [];

        const domainGroups = await Promise.all(downloads.map(task => task(dummySpan)));
        domainGroups.forEach(appendArrayInPlaceCurried(domainArr));

        // return domainArr;

        const domainCountMap = new Map<string, number>();
        const domainScoreMap: Record<string, number> = new NullPrototypeObject();

        let line = '';
        let tld: string | null = '';
        let apexDomain: string | null = '';
        let subdomain: string | null = '';
        let parsed: TldTsParsed;

        // const set = new Set<string>();
        // let duplicateCount = 0;

        for (let i = 0, len = domainArr.length; i < len; i++) {
          line = domainArr[i];

          // if (set.has(line)) {
          //   duplicateCount++;
          // } else {
          //   set.add(line);
          // }

          parsed = tldts.parse(line, loosTldOptWithPrivateDomains);
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
            } else if (tld.length > 6) {
              score += 2;
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
          // !WHITELIST_MAIN_DOMAINS.has(apexDomain)
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
      }
    }
  }
});

export function getPhishingDomains(parentSpan: Span) {
  return parentSpan.traceChild('get phishing domains').traceAsyncFn(async (span) => span.traceChildAsync(
    'process phishing domain set',
    async () => {
      const phishingDomains = await pool.exec(
        'getPhishingDomains',
        [
          import.meta.url,
          require.main === module
        ]
      );
      pool.terminate();
      return phishingDomains;
    }
  ));
}

if (require.main === module) {
  getPhishingDomains(dummySpan)
    .catch(console.error)
    .finally(() => {
      dummySpan.stop();
      printTraceResult(dummySpan.traceResult);
    });
}
