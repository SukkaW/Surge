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

export const surgeRulesetToClashClassicalTextRuleset = (rules: string[] | Set<string>) => {
  const trie = Trie.from(rules);
  return CLASH_SUPPORTED_RULE_TYPE.flatMap(
    type => trie.find(`${type},`)
  );
};

export const surgeDomainsetToClashDomainset = (domainset: string[]) => {
  return domainset.map(i => (i[0] === '.' ? `+${i}` : i));
};
