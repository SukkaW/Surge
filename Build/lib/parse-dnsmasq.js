const { fetchRemoteTextAndCreateReadlineInterface } = require('./fetch-remote-text-by-line');
const tldts = require('tldts');

const isDomainLoose = (domain) => {
  const { isIcann, isPrivate, isIp } = tldts.parse(domain);
  return !!(!isIp && (isIcann || isPrivate));
};

/**
 * @param {string | URL} url
 */
const parseFelixDnsmasq = async (url) => {
  /** @type {string[]} */
  const res = [];
  for await (const line of await fetchRemoteTextAndCreateReadlineInterface(url)) {
    if (line.startsWith('server=/') && line.endsWith('/114.114.114.114')) {
      const domain = line.replace('server=/', '').replace('/114.114.114.114', '');
      if (isDomainLoose(domain)) {
        res.push(domain);
      }
    }
  }

  return res;
};

module.exports.parseFelixDnsmasq = parseFelixDnsmasq;
