// @ts-check
const _Trie = require('mnemonist/trie');
const Trie = _Trie.default || _Trie;

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

/**
 * @param {string[] | Set<string>} rules
 */
const surgeRulesetToClashClassicalTextRuleset = (rules) => {
  const trie = Trie.from(rules);
  return CLASH_SUPPORTED_RULE_TYPE.flatMap(
    type => trie.find(`${type},`)
  );
};
module.exports.surgeRulesetToClashClassicalTextRuleset = surgeRulesetToClashClassicalTextRuleset;

/**
 * @param {string[]} domainset
 */
const surgeDomainsetToClashDomainset = (domainset) => {
  return domainset.map(i => (i[0] === '.' ? `+${i}` : i));
};
module.exports.surgeDomainsetToClashDomainset = surgeDomainsetToClashDomainset;
