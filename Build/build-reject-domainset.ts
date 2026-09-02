// @ts-check
import path from 'node:path';
import process from 'node:process';

import type { ProcessFilterRulesResult } from './lib/parse-filter/filters';

import { HOSTS, PREDEFINED_WHITELIST, DOMAIN_LISTS, HOSTS_EXTRA, DOMAIN_LISTS_EXTRA, PHISHING_HOSTS_EXTRA, PHISHING_DOMAIN_LISTS_EXTRA, BOGUS_NXDOMAIN_DNSMASQ, ENFORCED_BLACKLIST_FROM_WHITELIST } from './constants/reject-data-source';
import { readFileIntoProcessedArray } from './lib/fetch-text-by-line';
import { SpanCategory, task } from './trace';
// tldts-experimental is way faster than tldts, but very little bit inaccurate
// (since it is hashes based). But the result is still deterministic, which is
// enough when creating a simple stat of reject hosts.
import { SHARED_DESCRIPTION } from './constants/description';

import { addArrayElementsToSet } from 'foxts/add-array-elements-to-set';
import { OUTPUT_INTERNAL_DIR, SOURCE_DIR } from './constants/dir';
import { DomainsetOutput, AdGuardHomeOutput } from './lib/rules/domainset';
import { getBuildWorkerFarm } from './lib/build-worker-farm';
import { RulesetOutput } from './lib/rules/ruleset';
import { fetchAssets } from './lib/fetch-assets';
import { AUGUST_ASN, HUIZE_ASN } from '../Source/ip/badboy_asn';

const readLocalRejectDomainsetPromise = readFileIntoProcessedArray(path.join(SOURCE_DIR, 'domainset/reject.conf'));
const readLocalRejectExtraDomainsetPromise = readFileIntoProcessedArray(path.join(SOURCE_DIR, 'domainset/reject_extra.conf'));
const readLocalRejectRulesetPromise = readFileIntoProcessedArray(path.join(SOURCE_DIR, 'non_ip/reject.conf'));
const readLocalRejectIpListPromise = readFileIntoProcessedArray(path.resolve(SOURCE_DIR, 'ip/reject.conf'));

export const buildRejectDomainSet = task(require.main === module, __filename)(async (span) => {
  // Downloading + parsing the remote sources is ~1s of CPU that used to sit on the
  // main thread's critical path; the parsed arrays cross back in ~25ms (see
  // lib/worker-transfer.bench.ts). The farm is shared with the rest of the build
  // and ended by whoever booted it (index.ts, or process exit in standalone runs).
  const rejectWorker = getBuildWorkerFarm();
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
  rejectPhisingDomainsetOutput.addFromRuleset(readLocalRejectRulesetPromise);

  rejectNonIpRulesetOutput.addFromRuleset(readLocalRejectRulesetPromise);

  rejectDomainsetOutput.addFromDomainset(readLocalRejectDomainsetPromise);
  rejectExtraDomainsetOutput.addFromDomainset(readLocalRejectDomainsetPromise);
  rejectPhisingDomainsetOutput.addFromDomainset(readLocalRejectDomainsetPromise);

  rejectExtraDomainsetOutput.addFromDomainset(readLocalRejectExtraDomainsetPromise);

  rejectIPOutput.addFromRuleset(readLocalRejectIpListPromise);

  /** Whitelists */
  const filterRuleWhitelistDomainSets = new Set(PREDEFINED_WHITELIST);
  const filterRuleWhiteKeywords = new Set<string>();

  const mergeAdGuardFilter = (
    domainsetOutput: DomainsetOutput,
    {
      filterRulesUrl,
      whiteDomains, whiteDomainSuffixes,
      blackDomains, blackDomainSuffixes,
      blackIPs, blackWildcard,
      whiteKeyword, blackKeyword
    }: ProcessFilterRulesResult
  ) => {
    addArrayElementsToSet(filterRuleWhitelistDomainSets, whiteDomains);
    addArrayElementsToSet(filterRuleWhitelistDomainSets, whiteDomainSuffixes, suffix => '.' + suffix);

    addArrayElementsToSet(filterRuleWhiteKeywords, whiteKeyword);

    domainsetOutput.bulkAddDomain(blackDomains);
    domainsetOutput.bulkAddDomainSuffix(blackDomainSuffixes);

    domainsetOutput.bulkAddDomainKeyword(blackKeyword);

    domainsetOutput.appendDataSource(filterRulesUrl);

    rejectNonIpRulesetOutput.bulkAddDomainWildcard(blackWildcard);
    rejectNonIpRulesetOutput.appendDataSource(filterRulesUrl);

    rejectIPOutput.bulkAddAnyCIDR(blackIPs, false);
    rejectIPOutput.appendDataSource(filterRulesUrl);
  };

  const mergeAdGuardWhitelistFilter = ({ whiteDomains, whiteDomainSuffixes, blackDomains, blackDomainSuffixes, whiteKeyword, blackKeyword }: ProcessFilterRulesResult) => {
    addArrayElementsToSet(filterRuleWhitelistDomainSets, whiteDomains);
    addArrayElementsToSet(filterRuleWhitelistDomainSets, whiteDomainSuffixes, suffix => '.' + suffix);
    addArrayElementsToSet(filterRuleWhitelistDomainSets, blackDomains);
    addArrayElementsToSet(filterRuleWhitelistDomainSets, blackDomainSuffixes, suffix => '.' + suffix);
    addArrayElementsToSet(filterRuleWhiteKeywords, whiteKeyword);
    addArrayElementsToSet(filterRuleWhiteKeywords, blackKeyword);
  };

  const foundDebugDomain = await span
    .traceChild('download and process hosts / adblock filter rules')
    .traceAsyncFn(async (childSpan) => {
      rejectPhisingDomainsetOutput.addFromDomainset(
        childSpan.traceWorkerChild('get phishing domains', rawSpan => rejectWorker.getPhishingDomains(rawSpan))
      );

      const [sources] = await Promise.all([
        childSpan.traceWorkerChild('get reject sources', rawSpan => rejectWorker.getRejectSources(rawSpan)),

        childSpan.traceChildAsync(
          'get bogus nxdomain ips',
          () => fetchAssets(...BOGUS_NXDOMAIN_DNSMASQ, true, false).then(arr => {
            for (let i = 0, len = arr.length; i < len; i++) {
              const line = arr[i];
              if (line.startsWith('bogus-nxdomain=')) {
                rejectIPOutput.addAnyCIDR(
                  line.slice(15).trim(),
                  false // bogus nxdomain needs to be blocked even after resolved
                );
              }
            }
            // return arr;
          }),
          SpanCategory.Network
        )
      ]);

      // Everything below is trie / set insertion on the main thread -- the part
      // that can not move, since the tries live here.
      childSpan.traceChildSync('merge reject sources', () => {
        for (let i = 0, len = sources.hosts.length; i < len; i++) {
          rejectDomainsetOutput.addFromDomainset(sources.hosts[i]);
        }
        for (let i = 0, len = sources.domainLists.length; i < len; i++) {
          rejectDomainsetOutput.addFromDomainset(sources.domainLists[i]);
        }
        for (let i = 0, len = sources.hostsExtra.length; i < len; i++) {
          rejectExtraDomainsetOutput.addFromDomainset(sources.hostsExtra[i]);
        }
        for (let i = 0, len = sources.domainListsExtra.length; i < len; i++) {
          rejectExtraDomainsetOutput.addFromDomainset(sources.domainListsExtra[i]);
        }

        for (let i = 0, len = sources.adguardFilters.length; i < len; i++) {
          mergeAdGuardFilter(rejectDomainsetOutput, sources.adguardFilters[i]);
        }
        for (let i = 0, len = sources.adguardFiltersExtra.length; i < len; i++) {
          mergeAdGuardFilter(rejectExtraDomainsetOutput, sources.adguardFiltersExtra[i]);
        }
        for (let i = 0, len = sources.adguardFiltersWhitelist.length; i < len; i++) {
          mergeAdGuardWhitelistFilter(sources.adguardFiltersWhitelist[i]);
        }
      }, SpanCategory.Compute);

      return sources.foundDebugDomain;
    });

  if (foundDebugDomain) {
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

  ENFORCED_BLACKLIST_FROM_WHITELIST.forEach(domain => {
    filterRuleWhitelistDomainSets.delete(domain);
  });

  // whitelist
  span.traceChild('whitelist', SpanCategory.Compute).traceSyncFn(() => {
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

    // Deduplicate reject_extra and reject_phishing from the base reject domainset
    rejectDomainsetOutput.domainTrie.dump((domain, includeSubdomain) => {
      const arg = includeSubdomain ? '.' + domain : domain;
      rejectExtraDomainsetOutput.whitelistDomain(arg);
      rejectPhisingDomainsetOutput.whitelistDomain(arg);

      // e.g. .data.microsort.com can strip waston*.event.data.microsort.com
      // rejectNonIpRulesetOutput.wildcardTrie.whitelist(arg);
    });
  });

  // reject-adguardhome starts from the (whitelisted) reject trie and adds to it.
  // Cloning (~25ms for ~135k entries) instead of sharing the trie lets its write
  // run alongside the others instead of waiting for the reject write to finish
  // first (~0.4s serial on CI).
  const rejectOutputAdGuardHome = new AdGuardHomeOutput(span, 'reject-adguardhome', OUTPUT_INTERNAL_DIR)
    .withTitle('Sukka\'s Ruleset - AdGuardHome Blocklist')
    .withDescription([
      'The AdGuardHome ruleset supports AD blocking, tracking protection, privacy protection, anti-mining'
    ]);

  rejectOutputAdGuardHome.domainTrie = span.traceChildSync(
    'clone reject trie for adguardhome',
    () => rejectDomainsetOutput.domainTrie.clone(),
    SpanCategory.Compute
  );

  rejectOutputAdGuardHome
    // .addFromRuleset(readLocalMyRejectRulesetPromise)
    .addFromRuleset(readLocalRejectRulesetPromise)
    .addFromRuleset(readFileIntoProcessedArray(path.join(SOURCE_DIR, 'non_ip/reject-drop.conf')))
    .addFromRuleset(readFileIntoProcessedArray(path.join(SOURCE_DIR, 'non_ip/reject-no-drop.conf')))
    .addFromDomainset(readLocalRejectExtraDomainsetPromise);

  // each write() opens its own RuleOutput#<id> span under the task span
  await Promise.all([
    rejectDomainsetOutput.write(),
    rejectExtraDomainsetOutput.write(),
    rejectPhisingDomainsetOutput.write(),
    rejectIPOutput.write(),
    rejectNonIpRulesetOutput.write(),
    rejectOutputAdGuardHome.write()
  ]);

  const myRejectOutputAdGuardHome = new AdGuardHomeOutput(span, 'my-reject-adguardhome', OUTPUT_INTERNAL_DIR)
    .withTitle('Sukka\'s Ruleset - AdGuardHome Blocklist for Myself (Sukka)')
    .withDescription([]);

  await myRejectOutputAdGuardHome
    .addFromRuleset(readFileIntoProcessedArray(path.join(SOURCE_DIR, 'non_ip/my_reject.conf')))
    .write();
});
