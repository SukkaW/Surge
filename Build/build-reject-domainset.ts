// @ts-check
import path from 'node:path';
import process from 'node:process';

import { processHostsWithPreload } from './lib/parse-filter/hosts';
import { processDomainListsWithPreload } from './lib/parse-filter/domainlists';
import { processFilterRulesWithPreload } from './lib/parse-filter/filters';

import { HOSTS, ADGUARD_FILTERS, PREDEFINED_WHITELIST, DOMAIN_LISTS, HOSTS_EXTRA, DOMAIN_LISTS_EXTRA, ADGUARD_FILTERS_EXTRA, PHISHING_DOMAIN_LISTS_EXTRA, ADGUARD_FILTERS_WHITELIST } from './constants/reject-data-source';
import { compareAndWriteFile } from './lib/create-file';
import { readFileIntoProcessedArray } from './lib/fetch-text-by-line';
import { task } from './trace';
// tldts-experimental is way faster than tldts, but very little bit inaccurate
// (since it is hashes based). But the result is still deterministic, which is
// enough when creating a simple stat of reject hosts.
import { SHARED_DESCRIPTION } from './constants/description';
import { getPhishingDomains } from './lib/get-phishing-domains';

import { addArrayElementsToSet } from 'foxts/add-array-elements-to-set';
import { appendArrayInPlace } from './lib/append-array-in-place';
import { OUTPUT_INTERNAL_DIR, SOURCE_DIR } from './constants/dir';
import { DomainsetOutput } from './lib/create-file';
import { foundDebugDomain } from './lib/parse-filter/shared';

const readLocalRejectDomainsetPromise = readFileIntoProcessedArray(path.join(SOURCE_DIR, 'domainset/reject_sukka.conf'));
const readLocalRejectExtraDomainsetPromise = readFileIntoProcessedArray(path.join(SOURCE_DIR, 'domainset/reject_sukka_extra.conf'));
const readLocalRejectRulesetPromise = readFileIntoProcessedArray(path.join(SOURCE_DIR, 'non_ip/reject.conf'));
const readLocalRejectDropRulesetPromise = readFileIntoProcessedArray(path.join(SOURCE_DIR, 'non_ip/reject-drop.conf'));
const readLocalRejectNoDropRulesetPromise = readFileIntoProcessedArray(path.join(SOURCE_DIR, 'non_ip/reject-no-drop.conf'));
const readLocalMyRejectRulesetPromise = readFileIntoProcessedArray(path.join(SOURCE_DIR, 'non_ip/my_reject.conf'));

const hostsDownloads = HOSTS.map(entry => processHostsWithPreload(...entry));
const hostsExtraDownloads = HOSTS_EXTRA.map(entry => processHostsWithPreload(...entry));
const domainListsDownloads = DOMAIN_LISTS.map(entry => processDomainListsWithPreload(...entry));
const domainListsExtraDownloads = DOMAIN_LISTS_EXTRA.map(entry => processDomainListsWithPreload(...entry));
const adguardFiltersDownloads = ADGUARD_FILTERS.map(entry => processFilterRulesWithPreload(...entry));
const adguardFiltersExtraDownloads = ADGUARD_FILTERS_EXTRA.map(entry => processFilterRulesWithPreload(...entry));
const adguardFiltersWhitelistsDownloads = ADGUARD_FILTERS_WHITELIST.map(entry => processFilterRulesWithPreload(...entry));

export const buildRejectDomainSet = task(require.main === module, __filename)(async (span) => {
  const rejectBaseDescription = [
    ...SHARED_DESCRIPTION,
    '',
    'The domainset supports AD blocking, tracking protection, privacy protection, anti-phishing, anti-mining',
    '',
    'Build from:',
    ...HOSTS.map(host => ` - ${host[0]}`),
    ...DOMAIN_LISTS.map(domainList => ` - ${domainList[0]}`),
    ...ADGUARD_FILTERS.map(filter => ` - ${Array.isArray(filter) ? filter[0] : filter}`)
  ];

  const rejectOutput = new DomainsetOutput(span, 'reject')
    .withTitle('Sukka\'s Ruleset - Reject Base')
    .withDescription(rejectBaseDescription);

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
  await span
    .traceChild('download and process hosts / adblock filter rules')
    .traceAsyncFn((childSpan) => Promise.all([
      // Parse from remote hosts & domain lists
      hostsDownloads.map(task => task(childSpan).then(appendArrayToRejectOutput)),
      hostsExtraDownloads.map(task => task(childSpan).then(appendArrayToRejectExtraOutput)),

      domainListsDownloads.map(task => task(childSpan).then(appendArrayToRejectOutput)),
      domainListsExtraDownloads.map(task => task(childSpan).then(appendArrayToRejectExtraOutput)),

      adguardFiltersDownloads.map(
        task => task(childSpan).then(({ whiteDomains, whiteDomainSuffixes, blackDomains, blackDomainSuffixes }) => {
          addArrayElementsToSet(filterRuleWhitelistDomainSets, whiteDomains);
          addArrayElementsToSet(filterRuleWhitelistDomainSets, whiteDomainSuffixes, suffix => '.' + suffix);

          rejectOutput.bulkAddDomain(blackDomains);
          rejectOutput.bulkAddDomainSuffix(blackDomainSuffixes);
        })
      ),
      adguardFiltersExtraDownloads.map(
        task => task(childSpan).then(({ whiteDomains, whiteDomainSuffixes, blackDomains, blackDomainSuffixes }) => {
          addArrayElementsToSet(filterRuleWhitelistDomainSets, whiteDomains);
          addArrayElementsToSet(filterRuleWhitelistDomainSets, whiteDomainSuffixes, suffix => '.' + suffix);

          rejectOutput.bulkAddDomain(blackDomains);
          rejectOutput.bulkAddDomainSuffix(blackDomainSuffixes);
        })
      ),
      adguardFiltersWhitelistsDownloads.map(
        task => task(childSpan).then(({ whiteDomains, whiteDomainSuffixes, blackDomains, blackDomainSuffixes }) => {
          addArrayElementsToSet(filterRuleWhitelistDomainSets, whiteDomains);
          addArrayElementsToSet(filterRuleWhitelistDomainSets, whiteDomainSuffixes, suffix => '.' + suffix);
          addArrayElementsToSet(filterRuleWhitelistDomainSets, blackDomains);
          addArrayElementsToSet(filterRuleWhitelistDomainSets, blackDomainSuffixes, suffix => '.' + suffix);
        })
      ),
      getPhishingDomains(childSpan).then(appendArrayToRejectExtraOutput),
      readLocalRejectDomainsetPromise.then(appendArrayToRejectOutput),
      readLocalRejectDomainsetPromise.then(appendArrayToRejectExtraOutput),
      readLocalRejectExtraDomainsetPromise.then(appendArrayToRejectExtraOutput),
      // Dedupe domainSets
      // span.traceChildAsync('collect black keywords/suffixes', async () =>
      /**
         * Collect DOMAIN, DOMAIN-SUFFIX, and DOMAIN-KEYWORD from non_ip/reject.conf for deduplication
         * DOMAIN-WILDCARD is not really useful for deduplication, it is only included in AdGuardHome output
        */
      rejectOutput.addFromRuleset(readLocalRejectRulesetPromise),
      rejectExtraOutput.addFromRuleset(readLocalRejectRulesetPromise)
    ].flat()));

  if (foundDebugDomain.value) {
    process.exit(1);
  }

  await Promise.all([
    rejectOutput.done(),
    rejectExtraOutput.done()
  ]);

  // whitelist
  span.traceChildSync('whitelist', () => {
    for (const domain of filterRuleWhitelistDomainSets) {
      rejectOutput.whitelistDomain(domain);
      rejectExtraOutput.whitelistDomain(domain);
    }

    for (let i = 0, len = rejectOutput.$preprocessed.length; i < len; i++) {
      rejectExtraOutput.whitelistDomain(rejectOutput.$preprocessed[i]);
    }
  });

  return Promise.all([
    rejectOutput.write(),
    rejectExtraOutput.write(),
    compareAndWriteFile(
      span,
      appendArrayInPlace(
        [
          '! Title: Sukka\'s Ruleset - Blocklist for AdGuardHome',
          '! Last modified: ' + new Date().toUTCString(),
          '! Expires: 6 hours',
          '! License: https://github.com/SukkaW/Surge/blob/master/LICENSE',
          '! Homepage: https://github.com/SukkaW/Surge',
          '! Description: The domainset supports AD blocking, tracking protection, privacy protection, anti-phishing, anti-mining',
          '!'
        ],
        appendArrayInPlace(
          rejectOutput.adguardhome(),
          (
            await new DomainsetOutput(span, 'my_reject')
              .addFromRuleset(readLocalMyRejectRulesetPromise)
              .addFromRuleset(readLocalRejectRulesetPromise)
              .addFromRuleset(readLocalRejectDropRulesetPromise)
              .addFromRuleset(readLocalRejectNoDropRulesetPromise)
              .done()
          ).adguardhome()
        )
      ),
      path.join(OUTPUT_INTERNAL_DIR, 'reject-adguardhome.txt')
    )
  ]);
});
