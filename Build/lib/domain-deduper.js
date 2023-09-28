// @ts-check
const createTrie = require('./trie');

/**
 * @param {string[]} inputDomains
 */
const domainDeduper = (inputDomains) => {
  const trie = createTrie(inputDomains);
  const sets = new Set(inputDomains);

  for (let j = 0, len = inputDomains.length; j < len; j++) {
    const d = inputDomains[j];
    if (d[0] !== '.') {
      continue;
    }

    // delete all included subdomains (ends with `.example.com`)
    // eslint-disable-next-line sukka/unicorn/no-array-method-this-argument -- it is not an array
    trie.find(d, false).forEach(f => sets.delete(f));

    // if `.example.com` exists, then `example.com` should also be removed
    const a = d.slice(1);
    if (trie.has(a)) {
      sets.delete(a);
    }
  }

  return Array.from(sets);
};

module.exports.domainDeduper = domainDeduper;
