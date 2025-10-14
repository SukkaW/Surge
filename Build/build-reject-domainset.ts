// @ts-check
import path from 'node:path';
import process from 'node:process';

import { processHostsWithPreload } from './lib/parse-filter/hosts';
import { processDomainListsWithPreload } from './lib/parse-filter/domainlists';
import { processFilterRulesWithPreload } from './lib/parse-filter/filters';

import { HOSTS, ADGUARD_FILTERS, PREDEFINED_WHITELIST, DOMAIN_LISTS, HOSTS_EXTRA, DOMAIN_LISTS_EXTRA, ADGUARD_FILTERS_EXTRA, ADGUARD_FILTERS_WHITELIST, PHISHING_HOSTS_EXTRA, PHISHING_DOMAIN_LISTS_EXTRA, BOGUS_NXDOMAIN_DNSMASQ } from './constants/reject-data-source';
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
import { RulesetOutput } from './lib/rules/ruleset';
import { fetchAssets } from './lib/fetch-assets';
import { AUGUST_ASN, HUIZE_ASN } from '../Source/ip/badboy_asn';
import { arrayPushNonNullish } from 'foxts/array-push-non-nullish';

const readLocalRejectDomainsetPromise = readFileIntoProcessedArray(path.join(SOURCE_DIR, 'domainset/reject.conf'));
const readLocalRejectExtraDomainsetPromise = readFileIntoProcessedArray(path.join(SOURCE_DIR, 'domainset/reject_extra.conf'));
const readLocalRejectRulesetPromise = readFileIntoProcessedArray(path.join(SOURCE_DIR, 'non_ip/reject.conf'));
const readLocalRejectIpListPromise = readFileIntoProcessedArray(path.resolve(SOURCE_DIR, 'ip/reject.conf'));

const hostsDownloads = HOSTS.map(entry => processHostsWithPreload(...entry));
const hostsExtraDownloads = HOSTS_EXTRA.map(entry => processHostsWithPreload(...entry));
const domainListsDownloads = DOMAIN_LISTS.map(entry => processDomainListsWithPreload(...entry));
const domainListsExtraDownloads = DOMAIN_LISTS_EXTRA.map(entry => processDomainListsWithPreload(...entry));
const adguardFiltersDownloads = ADGUARD_FILTERS.map(entry => processFilterRulesWithPreload(...entry));
const adguardFiltersExtraDownloads = ADGUARD_FILTERS_EXTRA.map(entry => processFilterRulesWithPreload(...entry));
const adguardFiltersWhitelistsDownloads = ADGUARD_FILTERS_WHITELIST.map(entry => processFilterRulesWithPreload(...entry));

export const buildRejectDomainSet = task(require.main === module, __filename)(async (span) => {
  const rejectDomainsetOutput = new DomainsetOutput(span, 'reject')
    .withTitle('Sukka\'s Ruleset - Reject Base')
    .appendDescription(
      SHARED_DESCRIPTION,
      '',
      'The domainset supports AD blocking, tracking protection, privacy protection, anti-mining'
    )
    .appendDataSource(HOSTS.map(host => host[0]))
    .appendDataSource(DOMAIN_LISTS.map(domainList => domainList[0]));

  const rejectExtraDomainsetOutput = new DomainsetOutput(span, 'reject_extra')
    .withTitle('Sukka\'s Ruleset - Reject Extra')
    .appendDescription(
      SHARED_DESCRIPTION,
      '',
      'The domainset supports AD blocking, tracking protection, privacy protection, anti-mining'
    )
    .appendDataSource(HOSTS_EXTRA.map(host => host[0]))
    .appendDataSource(DOMAIN_LISTS_EXTRA.map(domainList => domainList[0]));

  const rejectPhisingDomainsetOutput = new DomainsetOutput(span, 'reject_phishing')
    .withTitle('Sukka\'s Ruleset - Reject Phishing')
    .appendDescription(
      SHARED_DESCRIPTION,
      '',
      'The domainset is specifically designed for anti-phishing'
    )
    .appendDataSource(PHISHING_HOSTS_EXTRA.map(host => host[0]))
    .appendDataSource(PHISHING_DOMAIN_LISTS_EXTRA.map(domainList => domainList[0]));

  const rejectNonIpRulesetOutput = new RulesetOutput(span, 'reject', 'non_ip')
    .withTitle('Sukka\'s Ruleset - Reject Non-IP')
    .appendDescription(SHARED_DESCRIPTION, '')
    .appendDescription(
      'The ruleset supports AD blocking, tracking protection, privacy protection, anti-phishing, anti-mining',
      '',
      'The file contains wildcard domains from data source mentioned in /domainset/reject file'
    );

  const rejectIPOutput = new RulesetOutput(span, 'reject', 'ip')
    .withTitle('Sukka\'s Ruleset - Anti Bogus Domain')
    .appendDescription(
      SHARED_DESCRIPTION,
      '',
      'This file contains known addresses that are hijacking NXDOMAIN results returned by DNS servers, and botnet controller IPs.'
    )
    .appendDataSource('https://github.com/felixonmars/dnsmasq-china-list')
    .appendDataSource('https://github.com/curbengh/botnet-filter')
    .bulkAddIPASN(AUGUST_ASN)
    .bulkAddIPASN(HUIZE_ASN);

  // Dedupe domainSets (no need to await this)
  // Collect DOMAIN, DOMAIN-SUFFIX, and DOMAIN-KEYWORD from non_ip/reject.conf for deduplication
  // DOMAIN-WILDCARD is not really useful for deduplication, it is only included in AdGuardHome output
  // It is faster to add base than add others first then whitelist
  rejectDomainsetOutput.addFromRuleset(readLocalRejectRulesetPromise);
  rejectExtraDomainsetOutput.addFromRuleset(readLocalRejectRulesetPromise);

  rejectNonIpRulesetOutput.addFromRuleset(readLocalRejectRulesetPromise);

  rejectDomainsetOutput.addFromDomainset(readLocalRejectDomainsetPromise);
  rejectExtraDomainsetOutput.addFromDomainset(readLocalRejectDomainsetPromise);
  rejectPhisingDomainsetOutput.addFromDomainset(readLocalRejectDomainsetPromise);

  rejectExtraDomainsetOutput.addFromDomainset(readLocalRejectExtraDomainsetPromise);

  rejectIPOutput.addFromRuleset(readLocalRejectIpListPromise);

  const appendArrayToRejectOutput = (source: MaybePromise<AsyncIterable<string> | Iterable<string> | string[]>) => rejectDomainsetOutput.addFromDomainset(source);
  const appendArrayToRejectExtraOutput = (source: MaybePromise<AsyncIterable<string> | Iterable<string> | string[]>) => rejectExtraDomainsetOutput.addFromDomainset(source);

  /** Whitelists */
  const filterRuleWhitelistDomainSets = new Set(PREDEFINED_WHITELIST);
  const filterRuleWhiteKeywords = new Set<string>();

  // Parse from AdGuard Filters
  await span
    .traceChild('download and process hosts / adblock filter rules')
    .traceAsyncFn((childSpan) => {
      const promises: Array<Promise<void>> = [];
      // Parse from remote hosts & domain lists

      arrayPushNonNullish(promises, hostsDownloads.map(task => task(childSpan).then(appendArrayToRejectOutput)));
      arrayPushNonNullish(promises, hostsExtraDownloads.map(task => task(childSpan).then(appendArrayToRejectExtraOutput)));
      arrayPushNonNullish(promises, domainListsDownloads.map(task => task(childSpan).then(appendArrayToRejectOutput)));
      arrayPushNonNullish(promises, domainListsExtraDownloads.map(task => task(childSpan).then(appendArrayToRejectExtraOutput)));

      rejectPhisingDomainsetOutput.addFromDomainset(getPhishingDomains(childSpan));

      arrayPushNonNullish(
        promises,
        adguardFiltersDownloads.map(
          task => task(childSpan).then(({
            filterRulesUrl,
            whiteDomains, whiteDomainSuffixes,
            blackDomains, blackDomainSuffixes,
            blackIPs, blackWildcard,
            whiteKeyword, blackKeyword
          }) => {
            addArrayElementsToSet(filterRuleWhitelistDomainSets, whiteDomains);
            addArrayElementsToSet(filterRuleWhitelistDomainSets, whiteDomainSuffixes, suffix => '.' + suffix);

            addArrayElementsToSet(filterRuleWhiteKeywords, whiteKeyword);

            rejectDomainsetOutput.bulkAddDomain(blackDomains);
            rejectDomainsetOutput.bulkAddDomainSuffix(blackDomainSuffixes);

            rejectDomainsetOutput.bulkAddDomainKeyword(blackKeyword);

            rejectDomainsetOutput.appendDataSource(filterRulesUrl);

            rejectNonIpRulesetOutput.bulkAddDomainWildcard(blackWildcard);
            rejectNonIpRulesetOutput.appendDataSource(filterRulesUrl);

            rejectIPOutput.bulkAddAnyCIDR(blackIPs, false);
            rejectIPOutput.appendDataSource(filterRulesUrl);
          })
        )
      );

      arrayPushNonNullish(
        promises,
        adguardFiltersExtraDownloads.map(
          task => task(childSpan).then(({
            filterRulesUrl,
            whiteDomains, whiteDomainSuffixes,
            blackDomains, blackDomainSuffixes,
            blackIPs, blackWildcard, whiteKeyword, blackKeyword
          }) => {
            addArrayElementsToSet(filterRuleWhitelistDomainSets, whiteDomains);
            addArrayElementsToSet(filterRuleWhitelistDomainSets, whiteDomainSuffixes, suffix => '.' + suffix);
            addArrayElementsToSet(filterRuleWhiteKeywords, whiteKeyword);

            rejectExtraDomainsetOutput.bulkAddDomain(blackDomains);
            rejectExtraDomainsetOutput.bulkAddDomainSuffix(blackDomainSuffixes);

            rejectExtraDomainsetOutput.bulkAddDomainKeyword(blackKeyword);

            rejectExtraDomainsetOutput.appendDataSource(filterRulesUrl);

            rejectIPOutput.bulkAddAnyCIDR(blackIPs, false);
            rejectIPOutput.appendDataSource(filterRulesUrl);

            rejectNonIpRulesetOutput.bulkAddDomainWildcard(blackWildcard);
            rejectNonIpRulesetOutput.appendDataSource(filterRulesUrl);
          })
        )
      );
      arrayPushNonNullish(
        promises,
        adguardFiltersWhitelistsDownloads.map(
          task => task(childSpan).then(({ whiteDomains, whiteDomainSuffixes, blackDomains, blackDomainSuffixes, whiteKeyword, blackKeyword }) => {
            addArrayElementsToSet(filterRuleWhitelistDomainSets, whiteDomains);
            addArrayElementsToSet(filterRuleWhitelistDomainSets, whiteDomainSuffixes, suffix => '.' + suffix);
            addArrayElementsToSet(filterRuleWhitelistDomainSets, blackDomains);
            addArrayElementsToSet(filterRuleWhitelistDomainSets, blackDomainSuffixes, suffix => '.' + suffix);
            addArrayElementsToSet(filterRuleWhiteKeywords, whiteKeyword);
            addArrayElementsToSet(filterRuleWhiteKeywords, blackKeyword);
          })
        )
      );

      promises.push(span.traceChildAsync(
        'get bogus nxdomain ips',
        () => fetchAssets(...BOGUS_NXDOMAIN_DNSMASQ, true, false).then(arr => {
          for (let i = 0, len = arr.length; i < len; i++) {
            const line = arr[i];
            if (line.startsWith('bogus-nxdomain=')) {
              // bogus nxdomain needs to be blocked even after resolved
              rejectIPOutput.addAnyCIDR(
                line.slice(15).trim(),
                false
              );
            }
          }
          // return arr;
        })
      ));

      return Promise.all(promises);
    });

  if (foundDebugDomain.value) {
    // eslint-disable-next-line sukka/unicorn/no-process-exit -- cli App
    process.exit(1);
  }

  await Promise.all([
    rejectDomainsetOutput.done(),
    rejectExtraDomainsetOutput.done(),
    rejectPhisingDomainsetOutput.done(),
    rejectIPOutput.done(),
    rejectNonIpRulesetOutput.done()
  ]);

  // whitelist
  span.traceChildSync('whitelist', () => {
    for (const domain of filterRuleWhitelistDomainSets) {
      rejectDomainsetOutput.whitelistDomain(domain);
      rejectExtraDomainsetOutput.whitelistDomain(domain);
      rejectPhisingDomainsetOutput.whitelistDomain(domain);

      // DON'T Whitelist reject non_ip ruleset, we are force blocking thingshere
      // rejectNonIpRulesetOutput.whitelistDomain(domain);
    }

    // we use "whitelistKeyword" method, this will be used to create kwfilter internally
    for (const keyword of filterRuleWhiteKeywords) {
      rejectDomainsetOutput.whitelistKeyword(keyword);
      rejectExtraDomainsetOutput.whitelistKeyword(keyword);
      rejectPhisingDomainsetOutput.whitelistKeyword(keyword);
      rejectNonIpRulesetOutput.whitelistKeyword(keyword);
    }

    rejectDomainsetOutput.domainTrie.dump(arg => {
      rejectExtraDomainsetOutput.whitelistDomain(arg);
      rejectPhisingDomainsetOutput.whitelistDomain(arg);

      // e.g. .data.microsort.com can strip waston*.event.data.microsort.com
      rejectNonIpRulesetOutput.wildcardTrie.whitelist(arg);
    });
  });

  await Promise.all([
    rejectDomainsetOutput.write(),
    rejectExtraDomainsetOutput.write(),
    rejectPhisingDomainsetOutput.write(),
    rejectIPOutput.write(),
    rejectNonIpRulesetOutput.write()
  ]);

  // we are going to re-use rejectOutput's domainTrie and mutate it
  // so we must wait until we write rejectOutput to disk after we can mutate its trie
  const rejectOutputAdGuardHome = new AdGuardHomeOutput(span, 'reject-adguardhome', OUTPUT_INTERNAL_DIR)
    .withTitle('Sukka\'s Ruleset - AdGuardHome Blocklist')
    .withDescription([
      'The AdGuardHome ruleset supports AD blocking, tracking protection, privacy protection, anti-mining'
    ]);

  rejectOutputAdGuardHome.domainTrie = rejectDomainsetOutput.domainTrie;

  await rejectOutputAdGuardHome
    // .addFromRuleset(readLocalMyRejectRulesetPromise)
    .addFromRuleset(readLocalRejectRulesetPromise)
    .addFromRuleset(readFileIntoProcessedArray(path.join(SOURCE_DIR, 'non_ip/reject-drop.conf')))
    .addFromRuleset(readFileIntoProcessedArray(path.join(SOURCE_DIR, 'non_ip/reject-no-drop.conf')))
    .addFromDomainset(readLocalRejectExtraDomainsetPromise)
    .write();

  const myRejectOutputAdGuardHome = new AdGuardHomeOutput(span, 'my-reject-adguardhome', OUTPUT_INTERNAL_DIR)
    .withTitle('Sukka\'s Ruleset - AdGuardHome Blocklist for Myself (Sukka)')
    .withDescription([]);

  await myRejectOutputAdGuardHome
    .addFromRuleset(readFileIntoProcessedArray(path.join(SOURCE_DIR, 'non_ip/my_reject.conf')))
    .write();
});
