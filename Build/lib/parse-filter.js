const { isIP } = require('net');
const { default: got } = require('got-cjs');

const rDomain = /^(((?!\-))(xn\-\-)?[a-z0-9\-_]{0,61}[a-z0-9]{1,1}\.)*(xn\-\-)?([a-z0-9\-]{1,61}|[a-z0-9\-]{1,30})\.[a-z]{2,}$/m

/**
 * @param {string | URL} domainListsUrl
 */
async function processDomainLists(domainListsUrl) {
  if (typeof domainListsUrl === 'string') {
    domainListsUrl = new URL(domainListsUrl);
  }

  /** @type Set<string> */
  const domainSets = new Set();
  /** @type string[] */
  const domains = (await got(domainListsUrl).text()).split('\n');
  domains.forEach(line => {
    if (
      line.startsWith('#')
      || line.startsWith('!')
      || line.startsWith(' ')
      || line === ''
      || line.startsWith('\r')
      || line.startsWith('\n')
    ) {
      return;
    }
    domainSets.add(line.trim());
  });

  return [...domainSets];
}

/**
 * @param {string | URL} hostsUrl
 */
async function processHosts(hostsUrl, includeAllSubDomain = false) {
  if (typeof hostsUrl === 'string') {
    hostsUrl = new URL(hostsUrl);
  }

  /** @type Set<string> */
  const domainSets = new Set();

  /** @type string[] */
  const hosts = (await got(hostsUrl).text()).split('\n');
  hosts.forEach(line => {
    if (line.includes('#')) {
      return;
    }
    if (line.startsWith(' ') || line.startsWith('\r') || line.startsWith('\n') || line.trim() === '') {
      return;
    }
    const [, ...domains] = line.split(' ');
    const domain = domains.join(' ').trim();
    if (rDomain.test(domain)) {
      if (includeAllSubDomain) {
        domainSets.add(`.${domain}`);
      } else {
        domainSets.add(domain);
      }
    }
  });

  return [...domainSets];
}

/**
 * @param {string | URL} filterRulesUrl
 * @returns {Promise<{ white: Set<string>, black: Set<string> }>}
 */
async function processFilterRules(filterRulesUrl) {
  if (typeof filterRulesUrl === 'string') {
    filterRulesUrl = new URL(filterRulesUrl);
  }

  /** @type Set<string> */
  const whitelistDomainSets = new Set();
  /** @type Set<string> */
  const blacklistDomainSets = new Set();

  /** @type string[] */
  const filterRules = (await got(filterRulesUrl).text()).split('\n').map(line => line.trim());

  filterRules.forEach(line => {
    if (
      line === ''
      || line.includes('#')
      || line.includes('!')
      || line.includes('*')
      || line.includes('/')
      || line.includes('$') && !line.startsWith('@@')
      || line.trim() === ''
      || isIP(line) !== 0
    ) {
      return;
    }

    if (line.startsWith('@@||')
      && (
        line.endsWith('^')
        || line.endsWith('^|')
        || line.endsWith('^$badfilter')
        || line.endsWith('^$1p')
      )
    ) {
      const domain = line
        .replaceAll('@@||', '')
        .replaceAll('^$badfilter', '')
        .replaceAll('^$1p', '')
        .replaceAll('^|', '')
        .replaceAll('^', '')
        .trim();
      if (rDomain.test(domain)) {
        whitelistDomainSets.add(domain);
      }
    } else if (
      line.startsWith('||')
      && (
        line.endsWith('^')
        || line.endsWith('^|')
      )
    ) {
      const domain = `${line.replaceAll('||', '').replaceAll('^|', '').replaceAll('^', '')}`.trim();
      if (rDomain.test(domain)) {
        blacklistDomainSets.add(`.${domain}`);
      }
    } else if (line.startsWith('://')
      && (
        line.endsWith('^')
        || line.endsWith('^|')
      )
    ) {
      const domain = `${line.replaceAll('://', '').replaceAll('^|', '').replaceAll('^', '')}`.trim();
      if (rDomain.test(domain)) {
        blacklistDomainSets.add(domain);
      }
    }
  });

  return {
    white: whitelistDomainSets,
    black: blacklistDomainSets
  };
}

module.exports.processDomainLists = processDomainLists;
module.exports.processHosts = processHosts;
module.exports.processFilterRules = processFilterRules;
