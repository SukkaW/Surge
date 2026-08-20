import path from 'node:path';
import { domainToASCII } from 'node:url';
import { merge as mergeCidr } from 'fast-cidr-tools';
import { createRetrieKeywordFilter as createKeywordFilter } from 'foxts/retrie';

import type { BaseWriteStrategy } from '../writing-strategy/base';
import { AdGuardHome } from '../writing-strategy/adguardhome';
import { ClashClassicRuleSet, ClashDomainSet, ClashIPSet } from '../writing-strategy/clash';
import { LegacyClashPremiumClassicRuleSet } from '../writing-strategy/legacy-clash-premium';
import { SingboxSource } from '../writing-strategy/singbox';
import { SurfboardRuleSet } from '../writing-strategy/surfboard';
import { SurgeDomainSet, SurgeMitmSgmodule, SurgeRuleSet } from '../writing-strategy/surge';

/**
 * A structured-clone friendly snapshot of everything FileOutput feeds into its
 * strategies. Only `domains` is big (the '.'-prefixed trie dump, still unicode);
 * everything else is at most a few thousand short strings. Plain arrays are used
 * (not Set) so the contract survives any worker serialization mode.
 */
export interface StrategyWriteData {
  /** Raw trie dump, '.'-prefix means include-all-subdomain, NOT yet punycoded */
  domains: string[],
  domainKeywords: string[],
  whitelistKeywords: string[],
  wildcards: string[],
  userAgents: string[],
  processNames: string[],
  processPaths: string[],
  urlRegexes: string[],
  ipcidr: string[],
  ipcidrNoResolve: string[],
  ipcidr6: string[],
  ipcidr6NoResolve: string[],
  ipasn: string[],
  ipasnNoResolve: string[],
  geoip: string[],
  geoipNoResolve: string[],
  sourceIpOrCidr: string[],
  sourcePort: string[],
  destPort: string[],
  protocol: string[],
  otherRules: string[]
}

/**
 * Write a StrategyWriteData snapshot into strategies. This is the extracted body
 * of FileOutput#writeToStrategies and MUST keep the exact same write order, since
 * the order of writeXxx calls determines the line order of the final output.
 */
export function writeDataToStrategies(data: StrategyWriteData, strategies: BaseWriteStrategy[]): void {
  // We use both DOMAIN-KEYWORD and whitelisted keyword to whitelist DOMAIN and DOMAIN-SUFFIX
  const kwfilter = createKeywordFilter(data.domainKeywords.concat(data.whitelistKeywords));

  const strategiesLen = strategies.length;

  const domainEntries: Array<[domain: string, subdomain: boolean]> = [];
  for (let j = 0, len = data.domains.length; j < len; j++) {
    const line = data.domains[j];
    const includeSubdomain = line.charCodeAt(0) === 46; /* '.' */
    const d = domainToASCII(includeSubdomain ? line.slice(1) : line);
    if (d) domainEntries.push([d, includeSubdomain]);
  }
  domainEntries.sort((a, b) => (a[0].length - b[0].length) || (a[0] < b[0] ? -1 : (a[0] > b[0] ? 1 : 0)));
  for (let j = 0, entriesLen = domainEntries.length; j < entriesLen; j++) {
    const [domain, includeAllSubdomain] = domainEntries[j];
    if (kwfilter(domain)) {
      continue;
    }

    for (let i = 0; i < strategiesLen; i++) {
      const strategy = strategies[i];
      if (includeAllSubdomain) {
        strategy.writeDomainSuffix(domain);
      } else {
        strategy.writeDomain(domain);
      }
    }
  }

  // Now, we whitelisted out DOMAIN-KEYWORD
  const whiteKwfilter = createKeywordFilter(data.whitelistKeywords);
  const whitelistedKeywords = data.domainKeywords.filter(kw => !whiteKwfilter(kw));

  const domainKeywords = new Set(data.domainKeywords);
  const protocol = new Set(data.protocol);

  for (let i = 0; i < strategiesLen; i++) {
    const strategy = strategies[i];
    if (whitelistedKeywords.length) {
      strategy.writeDomainKeywords(domainKeywords);
    }

    if (protocol.size) {
      strategy.writeProtocols(protocol);
    }
  }

  if (data.wildcards.length) {
    data.wildcards.forEach((wildcard) => {
      // Overlapped w/ DOMAIN-kEYWORD
      if (kwfilter(wildcard)) {
        return;
      }

      for (let i = 0; i < strategiesLen; i++) {
        const strategy = strategies[i];
        strategy.writeDomainWildcard(wildcard);
      }
    });
  }

  const userAgent = new Set(data.userAgents);
  const processName = new Set(data.processNames);
  const processPath = new Set(data.processPaths);
  const sourcePort = new Set(data.sourcePort);
  const destPort = new Set(data.destPort);
  const urlRegex = new Set(data.urlRegexes);

  for (let i = 0; i < strategiesLen; i++) {
    const strategy = strategies[i];

    if (userAgent.size) {
      strategy.writeUserAgents(userAgent);
    }
    if (processName.size) {
      strategy.writeProcessNames(processName);
    }
    if (processPath.size) {
      strategy.writeProcessPaths(processPath);
    }

    if (data.sourceIpOrCidr.length) {
      strategy.writeSourceIpCidrs(data.sourceIpOrCidr);
    }

    if (sourcePort.size) {
      strategy.writeSourcePorts(sourcePort);
    }
    if (destPort.size) {
      strategy.writeDestinationPorts(destPort);
    }
    if (data.otherRules.length) {
      strategy.writeOtherRules(data.otherRules);
    }
    if (urlRegex.size) {
      strategy.writeUrlRegexes(urlRegex);
    }
  }

  let ipcidr: string[] | null = null;
  let ipcidrNoResolve: string[] | null = null;
  let ipcidr6: string[] | null = null;
  let ipcidr6NoResolve: string[] | null = null;

  if (data.ipcidr.length) {
    ipcidr = mergeCidr(data.ipcidr, true);
  }
  if (data.ipcidrNoResolve.length) {
    ipcidrNoResolve = mergeCidr(data.ipcidrNoResolve, true);
  }
  if (data.ipcidr6.length) {
    ipcidr6 = data.ipcidr6;
  }
  if (data.ipcidr6NoResolve.length) {
    ipcidr6NoResolve = data.ipcidr6NoResolve;
  }

  const ipasn = new Set(data.ipasn);
  const ipasnNoResolve = new Set(data.ipasnNoResolve);
  const geoip = new Set(data.geoip);
  const geoipNoResolve = new Set(data.geoipNoResolve);

  for (let i = 0; i < strategiesLen; i++) {
    const strategy = strategies[i];
    // no-resolve
    if (ipcidrNoResolve) {
      strategy.writeIpCidrs(ipcidrNoResolve, true);
    }
    if (ipcidr6NoResolve) {
      strategy.writeIpCidr6s(ipcidr6NoResolve, true);
    }
    if (ipasnNoResolve.size) {
      strategy.writeIpAsns(ipasnNoResolve, true);
    }
    if (geoipNoResolve.size) {
      strategy.writeGeoip(geoipNoResolve, true);
    }

    // triggers DNS resolution
    if (ipcidr?.length) {
      strategy.writeIpCidrs(ipcidr, false);
    }
    if (ipcidr6?.length) {
      strategy.writeIpCidr6s(ipcidr6, false);
    }
    if (ipasn.size) {
      strategy.writeIpAsns(ipasn, false);
    }
    if (geoip.size) {
      strategy.writeGeoip(geoip, false);
    }
  }
}

/** Where a strategy's output for a given output id lands on disk */
export function resolveStrategyOutputPath(strategy: BaseWriteStrategy, id: string): string {
  const basename = (strategy.overwriteFilename || id) + '.' + strategy.fileExtension;
  return path.join(
    strategy.outputDir,
    strategy.type
      ? path.join(strategy.type, basename)
      : basename
  );
}

/** Serializable stand-in for a strategy class instance crossing the worker boundary */
export interface StrategyDescriptor {
  name: string,
  type: string,
  outputDir: string,
  overwriteFilename: string | null
}

export function serializeStrategy(strategy: BaseWriteStrategy): StrategyDescriptor {
  return {
    name: strategy.name,
    type: strategy.type,
    outputDir: strategy.outputDir,
    overwriteFilename: strategy.overwriteFilename
  };
}

const strategyRegistry: Record<string, (d: StrategyDescriptor) => BaseWriteStrategy> = {
  'surge domainset': (d) => new SurgeDomainSet(d.outputDir),
  'surge ruleset': (d) => new SurgeRuleSet(d.type, d.outputDir),
  'surge sgmodule': (d) => new SurgeMitmSgmodule(d.overwriteFilename ?? '', d.outputDir),
  'clash domainset': (d) => new ClashDomainSet(d.outputDir),
  'clash ipcidr': (d) => new ClashIPSet(d.outputDir),
  'clash classic ruleset': (d) => new ClashClassicRuleSet(d.type, d.outputDir),
  'legacy clash premium classic ruleset': (d) => new LegacyClashPremiumClassicRuleSet(d.type as 'ip' | 'non_ip', d.outputDir),
  'surfboard for android ruleset': (d) => new SurfboardRuleSet(d.type as 'ip' | 'non_ip', d.outputDir),
  singbox: (d) => new SingboxSource(d.type as 'domainset' | 'non_ip' | 'ip', d.outputDir),
  adguardhome: (d) => new AdGuardHome(d.outputDir)
};

export function reviveStrategy(descriptor: StrategyDescriptor): BaseWriteStrategy {
  if (!(descriptor.name in strategyRegistry)) {
    throw new TypeError(`Unknown strategy "${descriptor.name}", add it to strategyRegistry before offloading it to the output worker`);
  }
  const strategy = strategyRegistry[descriptor.name](descriptor);
  if (descriptor.overwriteFilename) {
    strategy.withFilename(descriptor.overwriteFilename);
  }
  return strategy;
}

/** The payload of a single FileOutput#write offloaded to the output worker */
export interface OutputWorkerPayload {
  id: string,
  title: string,
  description: string[],
  dateMs: number,
  strategies: StrategyDescriptor[],
  data: StrategyWriteData
}
