import { merge } from 'fast-cidr-tools';
import type { Span } from '../../trace';
import createKeywordFilter from '../aho-corasick';
import { appendArrayInPlace } from '../append-array-in-place';
import { appendArrayFromSet } from '../misc';
import type { SingboxSourceFormat } from '../singbox';
import { sortDomains } from '../stable-sort-domain';
import { RuleOutput } from './base';

type Preprocessed = [domain: string[], domainSuffix: string[], sortedDomainRules: string[]];

export class RulesetOutput extends RuleOutput<Preprocessed> {
  constructor(span: Span, id: string, protected type: 'non_ip' | 'ip') {
    super(span, id);
  }

  protected preprocess() {
    const kwfilter = createKeywordFilter(this.domainKeywords);

    const domains: string[] = [];
    const domainSuffixes: string[] = [];
    const sortedDomainRules: string[] = [];

    for (const domain of sortDomains(this.domainTrie.dump(), this.apexDomainMap, this.subDomainMap)) {
      if (kwfilter(domain)) {
        continue;
      }
      if (domain[0] === '.') {
        domainSuffixes.push(domain.slice(1));
        sortedDomainRules.push(`DOMAIN-SUFFIX,${domain.slice(1)}`);
      } else {
        domains.push(domain);
        sortedDomainRules.push(`DOMAIN,${domain}`);
      }
    }

    return [domains, domainSuffixes, sortedDomainRules] satisfies Preprocessed;
  }

  surge(): string[] {
    const results: string[] = ['DOMAIN,this_ruleset_is_made_by_sukkaw.ruleset.skk.moe'];
    appendArrayInPlace(results, this.$preprocessed[2]);

    appendArrayFromSet(results, this.domainKeywords, i => `DOMAIN-KEYWORD,${i}`);
    appendArrayFromSet(results, this.domainWildcard, i => `DOMAIN-WILDCARD,${i}`);

    appendArrayFromSet(results, this.userAgent, i => `USER-AGENT,${i}`);

    appendArrayFromSet(results, this.processName, i => `PROCESS-NAME,${i}`);
    appendArrayFromSet(results, this.processPath, i => `PROCESS-NAME,${i}`);

    appendArrayInPlace(results, this.otherRules);

    appendArrayFromSet(results, this.urlRegex, i => `URL-REGEX,${i}`);

    appendArrayInPlace(
      results,
      merge(Array.from(this.ipcidrNoResolve)).map(i => `IP-CIDR,${i},no-resolve`, true)
    );
    appendArrayFromSet(results, this.ipcidr6NoResolve, i => `IP-CIDR6,${i},no-resolve`);
    appendArrayFromSet(results, this.ipasnNoResolve, i => `IP-ASN,${i},no-resolve`);
    appendArrayFromSet(results, this.groipNoResolve, i => `GEOIP,${i},no-resolve`);

    appendArrayInPlace(
      results,
      merge(Array.from(this.ipcidr)).map(i => `IP-CIDR,${i}`, true)
    );
    appendArrayFromSet(results, this.ipcidr6, i => `IP-CIDR6,${i}`);
    appendArrayFromSet(results, this.ipasn, i => `IP-ASN,${i}`);
    appendArrayFromSet(results, this.geoip, i => `GEOIP,${i}`);

    return results;
  }

  clash(): string[] {
    const results: string[] = ['DOMAIN,this_ruleset_is_made_by_sukkaw.ruleset.skk.moe'];

    appendArrayInPlace(results, this.$preprocessed[2]);

    appendArrayFromSet(results, this.domainKeywords, i => `DOMAIN-KEYWORD,${i}`);
    appendArrayFromSet(results, this.domainWildcard, i => `DOMAIN-REGEX,${RuleOutput.domainWildCardToRegex(i)}`);

    appendArrayFromSet(results, this.processName, i => `PROCESS-NAME,${i}`);
    appendArrayFromSet(results, this.processPath, i => `PROCESS-PATH,${i}`);

    // appendArrayInPlace(results, this.otherRules);

    appendArrayInPlace(
      results,
      merge(Array.from(this.ipcidrNoResolve)).map(i => `IP-CIDR,${i},no-resolve`, true)
    );
    appendArrayFromSet(results, this.ipcidr6NoResolve, i => `IP-CIDR6,${i},no-resolve`);
    appendArrayFromSet(results, this.ipasnNoResolve, i => `IP-ASN,${i},no-resolve`);
    appendArrayFromSet(results, this.groipNoResolve, i => `GEOIP,${i},no-resolve`);

    appendArrayInPlace(
      results,
      merge(Array.from(this.ipcidr)).map(i => `IP-CIDR,${i}`, true)
    );
    appendArrayFromSet(results, this.ipcidr6, i => `IP-CIDR6,${i}`);
    appendArrayFromSet(results, this.ipasn, i => `IP-ASN,${i}`);
    appendArrayFromSet(results, this.geoip, i => `GEOIP,${i}`);

    return results;
  }

  singbox(): string[] {
    const ip_cidr: string[] = [];
    appendArrayInPlace(
      ip_cidr,
      merge(
        appendArrayInPlace(Array.from(this.ipcidrNoResolve), Array.from(this.ipcidr)),
        true
      )
    );
    appendArrayFromSet(ip_cidr, this.ipcidr6NoResolve);
    appendArrayFromSet(ip_cidr, this.ipcidr6);

    const singbox: SingboxSourceFormat = {
      version: 2,
      rules: [{
        domain: appendArrayInPlace(['this_ruleset_is_made_by_sukkaw.ruleset.skk.moe'], this.$preprocessed[0]),
        domain_suffix: this.$preprocessed[1],
        domain_keyword: Array.from(this.domainKeywords),
        domain_regex: Array.from(this.domainWildcard).map(RuleOutput.domainWildCardToRegex),
        ip_cidr,
        process_name: Array.from(this.processName),
        process_path: Array.from(this.processPath)
      }]
    };

    return RuleOutput.jsonToLines(singbox);
  }
}
