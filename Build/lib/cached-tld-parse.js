const tldts = require('tldts');
const { createCache } = require('./cache-apply');

const cache = createCache('cached-tld-parse', true);

const sharedConfig = { allowPrivateDomains: true };

/**
 * @param {string} domain
 * @returns {ReturnType<import('tldts').parse>}
 */
module.exports.parse = (domain) => {
  return cache.sync(domain, () => tldts.parse(domain, sharedConfig));
};

const gothillGetDomainCache = createCache('cached-gorhill-get-domain', true);
/**
 * @param {import('gorhill-publicsuffixlist').default | null} gorhill
 */
module.exports.createCachedGorhillGetDomain = (gorhill) => {
  /**
   * @param {string} domain
   */
  return (domain) => gothillGetDomainCache.sync(domain, () => gorhill.getDomain(domain[0] === '.' ? domain.slice(1) : domain));
};
