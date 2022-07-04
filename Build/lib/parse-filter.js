const { isIP } = require('net');
const { fetch } = require('undici');

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
  const domains = (await (await fetch(domainListsUrl)).text()).split('\n');
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
  const hosts = (await(await fetch(hostsUrl)).text()).split('\n');
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
  const filterRules = (await (await fetch(filterRulesUrl)).text()).split('\n').map(line => line.trim());

  filterRules.forEach(line => {
    const lineStartsWithDoubleVerticalBar = line.startsWith('||');

    if (
      line === ''
      || line.includes('#')
      || line.includes('!')
      || line.includes('*')
      || line.includes('/')
      || line.includes('$') && !lineStartsWithDoubleVerticalBar
      || line === ''
      || isIP(line) !== 0
    ) {
      return;
    }

    const lineEndsWithCaret = line.endsWith('^');
    const lineEndsWithCaretVerticalBar = line.endsWith('^|');

    if (lineStartsWithDoubleVerticalBar && line.endsWith('^$badfilter')) {
      const domain = line.replace('||', '').replace('^$badfilter', '').trim();
      if (rDomain.test(domain)) {
        whitelistDomainSets.add(domain);
      }
    } else if (line.startsWith('@@||')
      && (
        lineEndsWithCaret
        || lineEndsWithCaretVerticalBar
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
      lineStartsWithDoubleVerticalBar
      && (
        lineEndsWithCaret
        || lineEndsWithCaretVerticalBar
        || line.endsWith('^$all')
      )
    ) {
      const domain = line
        .replaceAll('||', '')
        .replaceAll('^|', '')
        .replaceAll('^$all', '')
        .replaceAll('^', '')
        .trim();
      if (rDomain.test(domain)) {
        blacklistDomainSets.add(`.${domain}`);
      }
    } else if (line.startsWith('://')
      && (
        lineEndsWithCaret
        || lineEndsWithCaretVerticalBar
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
