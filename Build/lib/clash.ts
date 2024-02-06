// @ts-check
import Trie from 'mnemonist/trie';

// https://dreamacro.github.io/clash/configuration/rules.html
const CLASH_SUPPORTED_RULE_TYPE = [
  'DOMAIN',
  'DOMAIN-SUFFIX',
  'DOMAIN-KEYWORD',
  'GEOIP',
  'IP-CIDR',
  'IP-CIDR6',
  'SRC-IP-CIDR',
  'SRC-PORT',
  'DST-PORT',
  'PROCESS-NAME',
  'PROCESS-PATH'
];

const REQUIRE_REWRITE = {
  'DEST-PORT': 'DST-PORT',
  'IN-PORT': 'SRC-PORT'
} as const;

export const surgeRulesetToClashClassicalTextRuleset = (rules: string[] | Set<string>) => {
  const trie = Trie.from(rules);

  return CLASH_SUPPORTED_RULE_TYPE.flatMap(type => trie.find(`${type},`)).concat(
    Object.keys(REQUIRE_REWRITE).flatMap((type) => trie.find(`${type},`)
      .map(line => `${REQUIRE_REWRITE[type as keyof typeof REQUIRE_REWRITE]}${line.slice(type.length)}`))
  );
};

export const surgeDomainsetToClashDomainset = (domainset: string[]) => {
  return domainset.map(i => (i[0] === '.' ? `+${i}` : i));
};

export const surgeDomainsetToClashRuleset = (domainset: string[]) => {
  return domainset.map(i => (i[0] === '.' ? `DOMAIN-SUFFIX,${i.slice(1)}` : `DOMAIN,${i}`));
};
