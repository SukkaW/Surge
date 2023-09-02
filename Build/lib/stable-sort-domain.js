// @ts-check
const tldts = require('tldts');

const cache1 = Object.create(null);
/**
 * @param {string} url
 * @returns {ReturnType<typeof tldts.parse>}
 */
// eslint-disable-next-line no-return-assign -- cache
const parse = (url) => (cache1[url] ||= tldts.parse(url, { allowPrivateDomains: true }));

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
 * @param {string} a
 * @param {string} b
 * @returns {0 | 1 | -1}
 */
const domainSorter = (a, b) => {
  if (a === b) return 0;

  const aParsed = parse(a[0] === '.' ? a.slice(1) : a);
  const bParsed = parse(b[0] === '.' ? b.slice(1) : b);

  const resultDomainWithoutSuffix = compare(aParsed.domainWithoutSuffix, bParsed.domainWithoutSuffix);
  if (resultDomainWithoutSuffix !== 0) {
    return resultDomainWithoutSuffix;
  }

  const resultSuffix = compare(aParsed.publicSuffix, bParsed.publicSuffix);
  if (resultSuffix !== 0) {
    return resultSuffix;
  }

  const resultSubdomain = compare(aParsed.subdomain, bParsed.subdomain);
  if (resultSubdomain !== 0) {
    return resultSubdomain;
  }

  return 0;
};

module.exports = domainSorter;
