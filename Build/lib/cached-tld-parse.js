const tldts = require('tldts');
const { createCache } = require('./cache-apply');

const cache = createCache('cached-tld-parse', true);

const sharedConfig = { allowPrivateDomains: true };

/**
 * @param {string} domain
 * @returns {ReturnType<import('tldts').parse>}
 */
module.exports.parse = (domain) => cache.sync(domain, () => tldts.parse(domain, sharedConfig));

let gothillGetDomainCache = null;
/**
 * @param {import('gorhill-publicsuffixlist').default | null} gorhill
 */
module.exports.createCachedGorhillGetDomain = (gorhill) => {
  gothillGetDomainCache ||= createCache('cached-gorhill-get-domain', true);
  /**
   * @param {string} domain
   */
  return (domain) => (/** @type {ReturnType<typeof createCache>} */ (gothillGetDomainCache)).sync(domain, () => gorhill.getDomain(domain[0] === '.' ? domain.slice(1) : domain));
};
