// @ts-check
import path from 'node:path';
import process from 'node:process';

import { processHosts, processFilterRules, processDomainLists } from './lib/parse-filter';

import { HOSTS, ADGUARD_FILTERS, PREDEFINED_WHITELIST, DOMAIN_LISTS, HOSTS_EXTRA, DOMAIN_LISTS_EXTRA, ADGUARD_FILTERS_EXTRA, PHISHING_DOMAIN_LISTS_EXTRA } from './constants/reject-data-source';
import { compareAndWriteFile } from './lib/create-file';
import { readFileByLine, readFileIntoProcessedArray } from './lib/fetch-text-by-line';
import { task } from './trace';
// tldts-experimental is way faster than tldts, but very little bit inaccurate
// (since it is hashes based). But the result is still deterministic, which is
// enough when creating a simple stat of reject hosts.
import { SHARED_DESCRIPTION } from './lib/constants';
import { getPhishingDomains } from './lib/get-phishing-domains';

import { setAddFromArray } from './lib/set-add-from-array';
import { appendArrayInPlace } from './lib/append-array-in-place';
import { OUTPUT_INTERNAL_DIR, SOURCE_DIR } from './constants/dir';
import { DomainsetOutput } from './lib/create-file';

const getRejectSukkaConfPromise = readFileIntoProcessedArray(path.join(SOURCE_DIR, 'domainset/reject_sukka.conf'));

export const buildRejectDomainSet = task(require.main === module, __filename)(async (span) => {
  const rejectOutput = new DomainsetOutput(span, 'reject')
    .withTitle('Sukka\'s Ruleset - Reject Base')
    .withDescription([
      ...SHARED_DESCRIPTION,
      '',
      'The domainset supports AD blocking, tracking protection, privacy protection, anti-phishing, anti-mining',
      '',
      'Build from:',
      ...HOSTS.map(host => ` - ${host[0]}`),
      ...DOMAIN_LISTS.map(domainList => ` - ${domainList[0]}`),
      ...ADGUARD_FILTERS.map(filter => ` - ${Array.isArray(filter) ? filter[0] : filter}`)
    ]);

  const rejectExtraOutput = new DomainsetOutput(span, 'reject_extra')
    .withTitle('Sukka\'s Ruleset - Reject Extra')
    .withDescription([
      ...SHARED_DESCRIPTION,
      '',
      'The domainset supports AD blocking, tracking protection, privacy protection, anti-phishing, anti-mining',
      '',
      'Build from:',
      ...HOSTS_EXTRA.map(host => ` - ${host[0]}`),
      ...DOMAIN_LISTS_EXTRA.map(domainList => ` - ${domainList[0]}`),
      ...ADGUARD_FILTERS_EXTRA.map(filter => ` - ${Array.isArray(filter) ? filter[0] : filter}`),
      ...PHISHING_DOMAIN_LISTS_EXTRA.map(domainList => ` - ${domainList[0]}`)
    ]);

  const appendArrayToRejectOutput = rejectOutput.addFromDomainset.bind(rejectOutput);
  const appendArrayToRejectExtraOutput = rejectExtraOutput.addFromDomainset.bind(rejectExtraOutput);

  /** Whitelists */
  const filterRuleWhitelistDomainSets = new Set(PREDEFINED_WHITELIST);

  // Parse from AdGuard Filters
  const shouldStop = await span
    .traceChild('download and process hosts / adblock filter rules')
    .traceAsyncFn(async (childSpan) => {
      // eslint-disable-next-line sukka/no-single-return -- not single return
      let shouldStop = false;
      await Promise.all([
        // Parse from remote hosts & domain lists
        HOSTS.map(entry => processHosts(childSpan, ...entry).then(appendArrayToRejectOutput)),
        HOSTS_EXTRA.map(entry => processHosts(childSpan, ...entry).then(appendArrayToRejectExtraOutput)),

        DOMAIN_LISTS.map(entry => processDomainLists(childSpan, ...entry).then(appendArrayToRejectOutput)),
        DOMAIN_LISTS_EXTRA.map(entry => processDomainLists(childSpan, ...entry).then(appendArrayToRejectExtraOutput)),

        ADGUARD_FILTERS.map(
          entry => processFilterRules(childSpan, ...entry)
            .then(({ white, black, foundDebugDomain }) => {
              if (foundDebugDomain) {
                // eslint-disable-next-line sukka/no-single-return -- not single return
                shouldStop = true;
                // we should not break here, as we want to see full matches from all data source
              }
              setAddFromArray(filterRuleWhitelistDomainSets, white);
              appendArrayToRejectOutput(black);
            })
        ),
        ADGUARD_FILTERS_EXTRA.map(
          entry => processFilterRules(childSpan, ...entry)
            .then(({ white, black, foundDebugDomain }) => {
              if (foundDebugDomain) {
                // eslint-disable-next-line sukka/no-single-return -- not single return
                shouldStop = true;
                // we should not break here, as we want to see full matches from all data source
              }
              setAddFromArray(filterRuleWhitelistDomainSets, white);
              appendArrayToRejectExtraOutput(black);
            })
        ),

        ([
          'https://raw.githubusercontent.com/AdguardTeam/AdGuardSDNSFilter/master/Filters/exceptions.txt',
          'https://raw.githubusercontent.com/AdguardTeam/AdGuardSDNSFilter/master/Filters/exclusions.txt'
        ].map(
          input => processFilterRules(childSpan, input).then(({ white, black }) => {
            setAddFromArray(filterRuleWhitelistDomainSets, white);
            setAddFromArray(filterRuleWhitelistDomainSets, black);
          })
        )),
        getPhishingDomains(childSpan).then(appendArrayToRejectExtraOutput),
        getRejectSukkaConfPromise.then(appendArrayToRejectOutput)
      ].flat());
      // eslint-disable-next-line sukka/no-single-return -- not single return
      return shouldStop;
    });

  if (shouldStop) {
    process.exit(1);
  }

  // Dedupe domainSets
  await span.traceChildAsync('collect black keywords/suffixes', async () => {
    /** Collect DOMAIN-KEYWORD from non_ip/reject.conf for deduplication */
    for await (const line of readFileByLine(path.resolve(__dirname, '../Source/non_ip/reject.conf'))) {
      const [type, value] = line.split(',');

      if (type === 'DOMAIN-KEYWORD') {
        rejectOutput.addDomainKeyword(value); // Add for later deduplication
        rejectExtraOutput.addDomainKeyword(value); // Add for later deduplication
      } else if (type === 'DOMAIN-SUFFIX') {
        rejectOutput.addDomainSuffix(value); // Add for later deduplication
      }
    }
  });

  await Promise.all([
    rejectOutput.done(),
    rejectExtraOutput.done()
  ]);

  span.traceChildSync(
    'build domain map for sort & collect stat',
    () => {
      rejectOutput.calcDomainMap();
      rejectExtraOutput.calcDomainMap();
    }
  );

  // Create reject stats
  const rejectDomainsStats: string[] = span
    .traceChild('create reject stats')
    .traceSyncFn(() => {
      const results = [];
      results.push('=== base ===');
      appendArrayInPlace(results, rejectOutput.getStatMap());
      results.push('=== extra ===');
      appendArrayInPlace(results, rejectExtraOutput.getStatMap());
      return results;
    });

  return Promise.all([
    rejectOutput.write(),
    rejectExtraOutput.write(),
    compareAndWriteFile(
      span,
      rejectDomainsStats,
      path.join(OUTPUT_INTERNAL_DIR, 'reject-stats.txt')
    )
  ]);
});
