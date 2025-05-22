// @ts-check
import path from 'node:path';
import process from 'node:process';

import { processHostsWithPreload } from './lib/parse-filter/hosts';
import { processDomainListsWithPreload } from './lib/parse-filter/domainlists';
import { processFilterRulesWithPreload } from './lib/parse-filter/filters';

import { HOSTS, ADGUARD_FILTERS, PREDEFINED_WHITELIST, DOMAIN_LISTS, HOSTS_EXTRA, DOMAIN_LISTS_EXTRA, ADGUARD_FILTERS_EXTRA, ADGUARD_FILTERS_WHITELIST, PHISHING_HOSTS_EXTRA, PHISHING_DOMAIN_LISTS_EXTRA } from './constants/reject-data-source';
import { readFileIntoProcessedArray } from './lib/fetch-text-by-line';
import { task } from './trace';
// tldts-experimental is way faster than tldts, but very little bit inaccurate
// (since it is hashes based). But the result is still deterministic, which is
// enough when creating a simple stat of reject hosts.
import { SHARED_DESCRIPTION } from './constants/description';

import { addArrayElementsToSet } from 'foxts/add-array-elements-to-set';
import { OUTPUT_INTERNAL_DIR, SOURCE_DIR } from './constants/dir';
import { DomainsetOutput } from './lib/rules/domainset';
import { foundDebugDomain } from './lib/parse-filter/shared';
import { AdGuardHomeOutput } from './lib/rules/domainset';
import { getPhishingDomains } from './lib/get-phishing-domains';
import type { MaybePromise } from './lib/misc';

const readLocalRejectDomainsetPromise = readFileIntoProcessedArray(path.join(SOURCE_DIR, 'domainset/reject.conf'));
const readLocalRejectExtraDomainsetPromise = readFileIntoProcessedArray(path.join(SOURCE_DIR, 'domainset/reject_extra.conf'));
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
    'The domainset supports AD blocking, tracking protection, privacy protection, anti-mining',
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
      'The domainset supports AD blocking, tracking protection, privacy protection, anti-mining',
      '',
      'Build from:',
      ...HOSTS_EXTRA.map(host => ` - ${host[0]}`),
      ...DOMAIN_LISTS_EXTRA.map(domainList => ` - ${domainList[0]}`),
      ...ADGUARD_FILTERS_EXTRA.map(filter => ` - ${filter[0]}`)
    ]);

  const rejectPhisingOutput = new DomainsetOutput(span, 'reject_phishing')
    .withTitle('Sukka\'s Ruleset - Reject Phishing')
    .withDescription([
      ...SHARED_DESCRIPTION,
      '',
      'The domainset is specifically designed for anti-phishing',
      '',
      'Build from:',
      ...PHISHING_HOSTS_EXTRA.map(host => ` - ${host[0]}`),
      ...PHISHING_DOMAIN_LISTS_EXTRA.map(domainList => ` - ${domainList[0]}`)
    ]);

  const appendArrayToRejectOutput = (source: MaybePromise<AsyncIterable<string> | Iterable<string> | string[]>) => rejectOutput.addFromDomainset(source);
  const appendArrayToRejectExtraOutput = (source: MaybePromise<AsyncIterable<string> | Iterable<string> | string[]>) => rejectExtraOutput.addFromDomainset(source);

  /** Whitelists */
  const filterRuleWhitelistDomainSets = new Set(PREDEFINED_WHITELIST);

  // Parse from AdGuard Filters
  await span
    .traceChild('download and process hosts / adblock filter rules')
    .traceAsyncFn((childSpan) => Promise.all([
      // Dedupe domainSets
      // Collect DOMAIN, DOMAIN-SUFFIX, and DOMAIN-KEYWORD from non_ip/reject.conf for deduplication
      // DOMAIN-WILDCARD is not really useful for deduplication, it is only included in AdGuardHome output
      // It is faster to add base than add others first then whitelist
      rejectOutput.addFromRuleset(readLocalRejectRulesetPromise),
      rejectExtraOutput.addFromRuleset(readLocalRejectRulesetPromise),

      rejectOutput.addFromDomainset(readLocalRejectDomainsetPromise),
      rejectExtraOutput.addFromDomainset(readLocalRejectDomainsetPromise),
      rejectPhisingOutput.addFromDomainset(readLocalRejectDomainsetPromise),

      rejectExtraOutput.addFromDomainset(readLocalRejectExtraDomainsetPromise),

      // Parse from remote hosts & domain lists
      hostsDownloads.map(task => task(childSpan).then(appendArrayToRejectOutput)),
      hostsExtraDownloads.map(task => task(childSpan).then(appendArrayToRejectExtraOutput)),

      domainListsDownloads.map(task => task(childSpan).then(appendArrayToRejectOutput)),
      domainListsExtraDownloads.map(task => task(childSpan).then(appendArrayToRejectExtraOutput)),

      rejectPhisingOutput.addFromDomainset(getPhishingDomains(childSpan)),

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

          rejectExtraOutput.bulkAddDomain(blackDomains);
          rejectExtraOutput.bulkAddDomainSuffix(blackDomainSuffixes);
        })
      ),
      adguardFiltersWhitelistsDownloads.map(
        task => task(childSpan).then(({ whiteDomains, whiteDomainSuffixes, blackDomains, blackDomainSuffixes }) => {
          addArrayElementsToSet(filterRuleWhitelistDomainSets, whiteDomains);
          addArrayElementsToSet(filterRuleWhitelistDomainSets, whiteDomainSuffixes, suffix => '.' + suffix);
          addArrayElementsToSet(filterRuleWhitelistDomainSets, blackDomains);
          addArrayElementsToSet(filterRuleWhitelistDomainSets, blackDomainSuffixes, suffix => '.' + suffix);
        })
      )
    ].flat()));

  if (foundDebugDomain.value) {
    // eslint-disable-next-line sukka/unicorn/no-process-exit -- cli App
    process.exit(1);
  }

  await Promise.all([
    rejectOutput.done(),
    rejectExtraOutput.done(),
    rejectPhisingOutput.done()
  ]);

  // whitelist
  span.traceChildSync('whitelist', () => {
    for (const domain of filterRuleWhitelistDomainSets) {
      rejectOutput.whitelistDomain(domain);
      rejectExtraOutput.whitelistDomain(domain);
      rejectPhisingOutput.whitelistDomain(domain);
    }

    rejectOutput.domainTrie.dump(arg => rejectExtraOutput.whitelistDomain(arg));
    rejectOutput.domainTrie.dump(arg => rejectPhisingOutput.whitelistDomain(arg));
  });

  await Promise.all([
    rejectOutput.write(),
    rejectExtraOutput.write(),
    rejectPhisingOutput.write()
  ]);

  // we are going to re-use rejectOutput's domainTrie and mutate it
  // so we must wait until we write rejectOutput to disk after we can mutate its trie
  const rejectOutputAdGuardHome = new AdGuardHomeOutput(span, 'reject-adguardhome', OUTPUT_INTERNAL_DIR)
    .withTitle('Sukka\'s Ruleset - Blocklist for AdGuardHome')
    .withDescription([
      'The AdGuardHome ruleset supports AD blocking, tracking protection, privacy protection, anti-mining'
    ]);

  rejectOutputAdGuardHome.domainTrie = rejectOutput.domainTrie;

  await rejectOutputAdGuardHome
    .addFromRuleset(readLocalMyRejectRulesetPromise)
    .addFromRuleset(readLocalRejectRulesetPromise)
    .addFromRuleset(readLocalRejectDropRulesetPromise)
    .addFromRuleset(readLocalRejectNoDropRulesetPromise)
    .addFromDomainset(readLocalRejectExtraDomainsetPromise)
    // .
    .write();
});
