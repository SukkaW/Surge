// @ts-check
const _Trie = require('mnemonist/trie');
const Trie = _Trie.default || _Trie;

const CLASH_SUPPORTED_RULE_TYPE = [
  'DOMAIN-SUFFIX',
  'DOMAIN-KEYWORD',
  'DOMAIN',
  'SRC-IP-CIDR',
  'GEOIP',
  'IP-CIDR',
  'IP-CIDR6',
  'DST-PORT',
  'SRC-PORT'
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
