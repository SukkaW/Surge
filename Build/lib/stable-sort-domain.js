// @ts-check
/**
 * @param {string | null} a
 * @param {string | null} b
 * @returns {0 | 1 | -1}
 */
const compare = (a, b) => {
  if (a === b) return 0;
  if (b == null) {
    return 1;
  }
  if (a == null) {
    return -1;
  }

  if (a.length !== b.length) {
    const r = a.length - b.length;
    if (r > 0) {
      return 1;
    }
    if (r < 0) {
      return -1;
    }
    return 0;
  }

  for (let i = 0; i < a.length; i++) {
    if (b[i] == null) {
      return 1;
    }
    if (a[i] < b[i]) {
      return -1;
    }
    if (a[i] > b[i]) {
      return 1;
    }
  }
  return 0;
};

/**
 * @param {import('gorhill-publicsuffixlist').default | null} [gorhill]
 */
const createDomainSorter = (gorhill = null) => {
  if (gorhill) {
    /**
     * @param {string} input
     */
    const getDomain = require('./cached-tld-parse').createCachedGorhillGetDomain(gorhill);

    /**
   * @param {string} a
   * @param {string} b
   * @returns {0 | 1 | -1}
   */
    return (a, b) => {
      if (a === b) return 0;

      const aDomain = getDomain(a);
      const bDomain = getDomain(b);

      const resultDomain = compare(aDomain, bDomain);
      return resultDomain !== 0 ? resultDomain : compare(a, b);
    };
  }

  const tldts = require('./cached-tld-parse');
  /**
   * @param {string} a
   * @param {string} b
   * @returns {0 | 1 | -1}
   */
  return (a, b) => {
    if (a === b) return 0;

    const aDomain = tldts.parse(a).domain;
    const bDomain = tldts.parse(b).domain;

    const resultDomain = compare(aDomain, bDomain);
    return resultDomain !== 0 ? resultDomain : compare(a, b);
  };
};

module.exports = createDomainSorter();
module.exports.createDomainSorter = createDomainSorter;
