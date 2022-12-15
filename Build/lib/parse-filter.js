const { fetchWithRetry } = require('./fetch-retry');
const { normalizeDomain } = require('./is-domain-loose');

const DEBUG_DOMAIN_TO_FIND = null; // example.com | null
let foundDebugDomain = false;

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
      foundDebugDomain = true;
    }

    domainSets.add(domainToAdd);
  });

  return [...domainSets];
}

/**
 * @param {string | URL} hostsUrl
 */
async function processHosts (hostsUrl, includeAllSubDomain = false) {
  console.time(`   - processHosts: ${hostsUrl}`);

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
    const _domain = domains.join(' ').trim();

    if (DEBUG_DOMAIN_TO_FIND && _domain.includes(DEBUG_DOMAIN_TO_FIND)) {
      warnOnce(hostsUrl.toString(), false, DEBUG_DOMAIN_TO_FIND);
      foundDebugDomain = true;
    }

    const domain = normalizeDomain(_domain);
    if (domain) {
      if (includeAllSubDomain) {
        domainSets.add(`.${domain}`);
      } else {
        domainSets.add(domain);
      }
    }
  });

  console.timeEnd(`   - processHosts: ${hostsUrl}`);

  return [...domainSets];
}

/**
 * @param {string | URL} filterRulesUrl
 * @param {(string | URL)[] | undefined} fallbackUrls
 * @returns {Promise<{ white: Set<string>, black: Set<string>, foundDebugDomain: boolean }>}
 */
async function processFilterRules (filterRulesUrl, fallbackUrls) {
  console.time(`   - processFilterRules: ${filterRulesUrl}`);

  /** @type Set<string> */
  const whitelistDomainSets = new Set();
  /** @type Set<string> */
  const blacklistDomainSets = new Set();

  let filterRules;
  try {
    /** @type string[] */
    filterRules = (
      await Promise.any(
        [filterRulesUrl, ...(fallbackUrls || [])].map(
          async url => (await fetchWithRetry(url)).text()
        )
      )
    ).split('\n').map(line => line.trim());
  } catch (e) {
    console.log('Download Rule for [' + filterRulesUrl + '] failed');
    throw e;
  }

  for (let i = 0, len = filterRules.length; i < len; i++) {
    const line = filterRules[i];

    const lineStartsWithDoubleVerticalBar = line.startsWith('||');

    if (
      line === ''
      || line.includes('#')
      || line.includes('!')
      || line.includes('*')
      || line.includes('/')
      || line.includes('=')
      || line.includes('[')
      || line.includes('(')
      || line.includes('$') && !lineStartsWithDoubleVerticalBar
      || line.includes(']')
      || line.includes(')')
    ) {
      continue;
    }

    const lineEndsWithCaret = line.endsWith('^');
    const lineEndsWithCaretVerticalBar = line.endsWith('^|');

    if (lineStartsWithDoubleVerticalBar && line.endsWith('^$badfilter')) {
      const _domain = line.replace('||', '').replace('^$badfilter', '').trim();
      const domain = normalizeDomain(_domain);
      if (domain) {
        if (DEBUG_DOMAIN_TO_FIND && domain.includes(DEBUG_DOMAIN_TO_FIND)) {
          warnOnce(filterRulesUrl.toString(), true, DEBUG_DOMAIN_TO_FIND);
          foundDebugDomain = true;
        }

        whitelistDomainSets.add(domain);
      } else {
        console.warn('      * [parse-filter white] ' + _domain + ' is not a valid domain');
      }
    } else if (line.startsWith('@@||')
      && (
        lineEndsWithCaret
        || lineEndsWithCaretVerticalBar
        || line.endsWith('^$badfilter')
        || line.endsWith('^$1p')
      )
    ) {
      const _domain = line
        .replaceAll('@@||', '')
        .replaceAll('^$badfilter', '')
        .replaceAll('^$1p', '')
        .replaceAll('^|', '')
        .replaceAll('^', '')
        .trim();

      const domain = normalizeDomain(_domain);

      if (domain) {
        if (DEBUG_DOMAIN_TO_FIND && domain.includes(DEBUG_DOMAIN_TO_FIND)) {
          warnOnce(filterRulesUrl.toString(), true, DEBUG_DOMAIN_TO_FIND);
          foundDebugDomain = true;
        }

        whitelistDomainSets.add(domain);
      } else {
        console.warn('      * [parse-filter white] ' + _domain + ' is not a valid domain');
      }
    } else if (
      lineStartsWithDoubleVerticalBar
      && (
        lineEndsWithCaret
        || lineEndsWithCaretVerticalBar
        || line.endsWith('^$all')
        || line.endsWith('^$doc')
        || line.endsWith('^$document')
      )
    ) {
      const _domain = line
        .replaceAll('||', '')
        .replaceAll('^|', '')
        .replaceAll('^$all', '')
        .replaceAll('^$document', '')
        .replaceAll('^$doc', '')
        .replaceAll('^', '')
        .trim();

      const domain = normalizeDomain(_domain);

      if (domain) {
        if (DEBUG_DOMAIN_TO_FIND && domain.includes(DEBUG_DOMAIN_TO_FIND)) {
          warnOnce(filterRulesUrl.toString(), false, DEBUG_DOMAIN_TO_FIND);
          foundDebugDomain = true;
        }

        blacklistDomainSets.add(`.${domain}`);
      }
    } else if (
      line.startsWith('://')
      && (
        lineEndsWithCaret
        || lineEndsWithCaretVerticalBar
      )
    ) {
      const _domain = `${line.replaceAll('://', '').replaceAll('^|', '').replaceAll('^', '')}`.trim();
      const domain = normalizeDomain(_domain);
      if (domain) {
        if (DEBUG_DOMAIN_TO_FIND && domain.includes(DEBUG_DOMAIN_TO_FIND)) {
          warnOnce(filterRulesUrl.toString(), false, DEBUG_DOMAIN_TO_FIND);
          foundDebugDomain = true;
        }

        blacklistDomainSets.add(domain);
      }
    }
  }

  console.timeEnd(`   - processFilterRules: ${filterRulesUrl}`);

  return {
    white: whitelistDomainSets,
    black: blacklistDomainSets,
    foundDebugDomain
  };
}

function preprocessFullDomainSetBeforeUsedAsWorkerData (data) {
  return data.filter(domain => (
    domain.charCodeAt(0) === 46
  ));
}


module.exports.processDomainLists = processDomainLists;
module.exports.processHosts = processHosts;
module.exports.processFilterRules = processFilterRules;
module.exports.preprocessFullDomainSetBeforeUsedAsWorkerData = preprocessFullDomainSetBeforeUsedAsWorkerData;
