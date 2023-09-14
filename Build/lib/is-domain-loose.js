// @ts-check
const tldts = require('./cached-tld-parse');
/**
 * @param {string | null | undefined} domain
 */
module.exports.normalizeDomain = (domain) => {
  if (!domain) {
    return null;
  }

  const { isIcann, isPrivate, hostname, isIp } = tldts.parse(domain);
  if (isIp) {
    return null;
  }

  if (isIcann || isPrivate) {
    if (hostname?.[0] === '.') {
      return hostname.slice(1);
    }
    return hostname;
  }

  return null;
};
