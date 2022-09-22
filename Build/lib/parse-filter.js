const { isIP } = require('net');
const { fetchWithRetry } = require('./fetch-retry');

const rDomain = /^(((?!\-))(xn\-\-)?[a-z0-9\-_]{0,61}[a-z0-9]{1,1}\.)*(xn\-\-)?([a-z0-9\-]{1,61}|[a-z0-9\-]{1,30})\.[a-z]{2,}$/m

const DEBUG_DOMAIN_TO_FIND = null; // example.com | null

const warnOnceUrl = new Set();
const warnOnce = (url, isWhite, ...message) => {
  const key = `${url}${isWhite ? 'white' : 'black'}`;
  if (warnOnceUrl.has(key)) {
    return;
  }
  warnOnceUrl.add(key);
  console.warn(url, isWhite ? '(white)' : '(black)', ...message);
}

/**
 * @param {string | URL} domainListsUrl
 */
async function processDomainLists (domainListsUrl) {
  if (typeof domainListsUrl === 'string') {
    domainListsUrl = new URL(domainListsUrl);
  }

  /** @type Set<string> */
  const domainSets = new Set();
  /** @type string[] */
  const domains = (await (await fetchWithRetry(domainListsUrl)).text()).split('\n');
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

    const domainToAdd = line.trim();

    if (DEBUG_DOMAIN_TO_FIND && domainToAdd.includes(DEBUG_DOMAIN_TO_FIND)) {
      warnOnce(domainListsUrl.toString(), false, DEBUG_DOMAIN_TO_FIND);
    }

    domainSets.add(domainToAdd);
  });

  return [...domainSets];
}

/**
 * @param {string | URL} hostsUrl
 */
async function processHosts (hostsUrl, includeAllSubDomain = false) {
  if (typeof hostsUrl === 'string') {
    hostsUrl = new URL(hostsUrl);
  }

  /** @type Set<string> */
  const domainSets = new Set();

  /** @type string[] */
  const hosts = (await (await fetchWithRetry(hostsUrl)).text()).split('\n');
  hosts.forEach(line => {
    if (line.includes('#')) {
      return;
    }
    if (line.startsWith(' ') || line.startsWith('\r') || line.startsWith('\n') || line.trim() === '') {
      return;
    }
    const [, ...domains] = line.split(' ');
    const domain = domains.join(' ').trim();

    if (DEBUG_DOMAIN_TO_FIND && domain.includes(DEBUG_DOMAIN_TO_FIND)) {
      warnOnce(hostsUrl.toString(), false, DEBUG_DOMAIN_TO_FIND);
    }

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
 * @param {(string | URL)[] | undefined} fallbackUrls
 * @returns {Promise<{ white: Set<string>, black: Set<string> }>}
 */
async function processFilterRules (filterRulesUrl, fallbackUrls) {
  console.time(`   - processFilterRules: ${filterRulesUrl}`);

  if (typeof filterRulesUrl === 'string') {
    filterRulesUrl = new URL(filterRulesUrl);
  }

  /** @type Set<string> */
  const whitelistDomainSets = new Set();
  /** @type Set<string> */
  const blacklistDomainSets = new Set();

  /** @type string[] */
  const filterRules = (
    await Promise.any(
      [filterRulesUrl, ...(fallbackUrls || [])].map(
        async url => (await fetchWithRetry(url)).text()
      )
    )
  ).split('\n').map(line => line.trim());

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
        if (DEBUG_DOMAIN_TO_FIND && domain.includes(DEBUG_DOMAIN_TO_FIND)) {
          warnOnce(filterRulesUrl.toString(), true, DEBUG_DOMAIN_TO_FIND);
        }

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
        if (DEBUG_DOMAIN_TO_FIND && domain.includes(DEBUG_DOMAIN_TO_FIND)) {
          warnOnce(filterRulesUrl.toString(), true, DEBUG_DOMAIN_TO_FIND);
        }

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

        if (DEBUG_DOMAIN_TO_FIND && domain.includes(DEBUG_DOMAIN_TO_FIND)) {
          warnOnce(filterRulesUrl.toString(), false, DEBUG_DOMAIN_TO_FIND);
        }

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

        if (DEBUG_DOMAIN_TO_FIND && domain.includes(DEBUG_DOMAIN_TO_FIND)) {
          warnOnce(filterRulesUrl.toString(), false, DEBUG_DOMAIN_TO_FIND);
        }

        blacklistDomainSets.add(domain);
      }
    }
  });

  console.timeEnd(`   - processFilterRules: ${filterRulesUrl}`);

  return {
    white: whitelistDomainSets,
    black: blacklistDomainSets
  };
}

module.exports.processDomainLists = processDomainLists;
module.exports.processHosts = processHosts;
module.exports.processFilterRules = processFilterRules;
