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
 * @param {string} a
 * @param {string} b
 * @returns {0 | 1 | -1}
 */
const domainSorter = (a, b) => {
  if (a === b) return 0;

  const aParsed = parse(a);
  const bParsed = parse(b);

  const aSuffix = aParsed.publicSuffix;
  const bSuffix = bParsed.publicSuffix;

  if (bSuffix !== aSuffix) {
    if (bSuffix == null) {
      return 1;
    }
    if (aSuffix == null) {
      return -1;
    }

    for (let i = 0, l = aSuffix.length; i < l; i++) {
      if (bSuffix[i] == null) {
        return 1;
      }

      if (aSuffix[i] < bSuffix[i]) {
        return -1;
      }

      if (aSuffix[i] > bSuffix[i]) {
        return 1;
      }
    }
  }

  const aDomainWithoutSuffix = aParsed.domainWithoutSuffix;
  const bDomainWithoutSuffix = bParsed.domainWithoutSuffix;

  if (aDomainWithoutSuffix !== bDomainWithoutSuffix) {
    if (bDomainWithoutSuffix == null) {
      return 1;
    }
    if (aDomainWithoutSuffix == null) {
      return -1;
    }

    for (let i = 0, l = aDomainWithoutSuffix.length; i < l; i++) {
      if (bDomainWithoutSuffix[i] == null) {
        return 1;
      }

      if (aDomainWithoutSuffix[i] < bDomainWithoutSuffix[i]) {
        return -1;
      }

      if (aDomainWithoutSuffix[i] > bDomainWithoutSuffix[i]) {
        return 1;
      }
    }
  }

  const aSubdomain = aParsed.subdomain;
  const bSubdomain = bParsed.subdomain;

  if (aSubdomain !== bSubdomain) {
    if (bSubdomain == null) {
      return 1;
    }
    if (aSubdomain == null) {
      return -1;
    }

    for (let i = 0, l = aSubdomain.length; i < l; i++) {
      if (bSubdomain[i] == null) {
        return 1;
      }

      if (aSubdomain[i] < bSubdomain[i]) {
        return -1;
      }

      if (aSubdomain[i] > bSubdomain[i]) {
        return 1;
      }
    }
  }

  return 0;
};

module.exports = domainSorter;
