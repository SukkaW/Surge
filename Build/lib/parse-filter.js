// @ts-check
const { fetchWithRetry } = require('./fetch-retry');
const { fetchRemoteTextAndCreateReadlineInterface } = require('./fetch-remote-text-by-line');
const { NetworkFilter } = require('@cliqz/adblocker');
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
async function processDomainLists(domainListsUrl) {
  if (typeof domainListsUrl === 'string') {
    domainListsUrl = new URL(domainListsUrl);
  }

  /** @type Set<string> */
  const domainSets = new Set();

  const rl = await fetchRemoteTextAndCreateReadlineInterface(domainListsUrl);

  for await (const line of rl) {
    if (
      line.startsWith('#')
      || line.startsWith('!')
      || line.startsWith(' ')
      || line === ''
      || line.startsWith('\r')
      || line.startsWith('\n')
    ) {
      continue;
    }

    const domainToAdd = line.trim();

    if (DEBUG_DOMAIN_TO_FIND && domainToAdd.includes(DEBUG_DOMAIN_TO_FIND)) {
      warnOnce(domainListsUrl.toString(), false, DEBUG_DOMAIN_TO_FIND);
      foundDebugDomain = true;
    }

    domainSets.add(domainToAdd);
  }

  return domainSets;
}

/**
 * @param {string | URL} hostsUrl
 */
async function processHosts(hostsUrl, includeAllSubDomain = false) {
  console.time(`   - processHosts: ${hostsUrl}`);

  if (typeof hostsUrl === 'string') {
    hostsUrl = new URL(hostsUrl);
  }

  /** @type Set<string> */
  const domainSets = new Set();

  const rl = await fetchRemoteTextAndCreateReadlineInterface(hostsUrl);
  for await (const line of rl) {
    if (line.includes('#')) {
      continue;
    }
    if (line.startsWith(' ') || line.startsWith('\r') || line.startsWith('\n') || line.trim() === '') {
      continue;
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
  }

  console.timeEnd(`   - processHosts: ${hostsUrl}`);

  return domainSets;
}

/**
 * @param {string | URL} filterRulesUrl
 * @param {readonly (string | URL)[] | undefined} [fallbackUrls]
 * @returns {Promise<{ white: Set<string>, black: Set<string>, foundDebugDomain: boolean, parseFailed: boolean }>}
 */
async function processFilterRules(filterRulesUrl, fallbackUrls, includeThirdParties = false) {
  console.time(`   - processFilterRules: ${filterRulesUrl}`);

  /** @type Set<string> */
  const whitelistDomainSets = new Set();
  /** @type Set<string> */
  const blacklistDomainSets = new Set();

  const addToBlackList = (domainToBeAddedToBlack, isSubDomain) => {
    if (DEBUG_DOMAIN_TO_FIND && domainToBeAddedToBlack.includes(DEBUG_DOMAIN_TO_FIND)) {
      warnOnce(filterRulesUrl.toString(), false, DEBUG_DOMAIN_TO_FIND);
      foundDebugDomain = true;
    }

    if (isSubDomain && !domainToBeAddedToBlack.startsWith('.')) {
      blacklistDomainSets.add(`.${domainToBeAddedToBlack}`);
    } else {
      blacklistDomainSets.add(domainToBeAddedToBlack);
    }
  };
  const addToWhiteList = (domainToBeAddedToWhite) => {
    if (DEBUG_DOMAIN_TO_FIND && domainToBeAddedToWhite.includes(DEBUG_DOMAIN_TO_FIND)) {
      warnOnce(filterRulesUrl.toString(), true, DEBUG_DOMAIN_TO_FIND);
      foundDebugDomain = true;
    }
    whitelistDomainSets.add(domainToBeAddedToWhite);
  }

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

  let hasParseFailed = false;

  for (let i = 0, len = filterRules.length; i < len; i++) {
    const line = filterRules[i].trim();

    if (
      line === ''
      // doesn't include
      || !line.includes('.') // rule with out dot can not be a domain
      // includes
      || line.includes('#')
      || line.includes('!')
      || line.includes('?')
      || line.includes('*')
      || line.includes('=')
      || line.includes('[')
      || line.includes('(')
      || line.includes(']')
      || line.includes(')')
      || line.includes(',')
      || line.includes('~')
      || line.includes('&')
      || line.includes('%')
      || ((line.includes('/') || line.includes(':')) && !line.includes('://'))
      // ends with
      || line.endsWith('.')
      || line.endsWith('-')
      || line.endsWith('_')
      // special modifier
      || line.includes('$popup')
      || line.includes('$removeparam')
      || line.includes('$popunder')
    ) {
      continue;
    }

    const filter = NetworkFilter.parse(line);
    if (filter) {
      if (
        filter.isElemHide()
        || filter.isGenericHide()
        || filter.isSpecificHide()
        || filter.isRedirect()
        || filter.isRedirectRule()
        || filter.hasDomains()
        || filter.isCSP() // must not be csp rule
        || (!filter.fromAny() && !filter.fromDocument())
      ) {
        // not supported type
        continue;
      }

      if (
        filter.hasHostname() // must have
        && filter.isPlain()
        && (!filter.isRegex())
        && (!filter.isFullRegex())
      ) {
        const hostname = normalizeDomain(filter.getHostname());
        if (hostname) {
          if (filter.isException() || filter.isBadFilter()) {
            addToWhiteList(hostname);
            continue;
          }
          if (filter.firstParty() === filter.thirdParty()) {
            addToBlackList(hostname, true);
            continue;
          }
          if (filter.thirdParty()) {
            if (includeThirdParties) {
              addToBlackList(hostname, true);
            }
            continue;
          }
          if (filter.firstParty()) {
            continue;
          }
        } else {
          continue;
        }
      }
    }

    if (line.includes('$third-party') || line.includes('$frame')) {
      continue;
    }

    const lineEndsWithCaret = line.endsWith('^');
    const lineEndsWithCaretVerticalBar = line.endsWith('^|');

    if (line.startsWith('@@')) {
      if (line.endsWith('$cname')) {
        continue;
      }

      if (
        (line.startsWith('@@|') || line.startsWith('@@.'))
        && (
          lineEndsWithCaret
          || lineEndsWithCaretVerticalBar
          || line.endsWith('$genericblock')
          || line.endsWith('$document')
        )
      ) {
        const _domain = line
          .replace('@@||', '')
          .replace('@@|', '')
          .replace('@@.', '')
          .replace('^|', '')
          .replace('^$genericblock', '')
          .replace('$genericblock', '')
          .replace('^$document', '')
          .replace('$document', '')
          .replaceAll('^', '')
          .trim();

        const domain = normalizeDomain(_domain);
        if (domain) {
          addToWhiteList(domain);
        } else {
          console.warn('      * [parse-filter E0001] (black) invalid domain:', _domain);
        }

        continue;
      }
    }

    if (
      line.startsWith('||')
      && (
        lineEndsWithCaret
        || lineEndsWithCaretVerticalBar
        || line.endsWith('$cname')
      )
    ) {
      const _domain = line
        .replace('||', '')
        .replace('^|', '')
        .replace('$cname', '')
        .replaceAll('^', '')
        .trim();

      const domain = normalizeDomain(_domain);
      if (domain) {
        addToBlackList(domain, true);
      } else {
        console.warn('      * [parse-filter E0002] (black) invalid domain:', _domain);
      }
      continue;
    }

    const lineStartsWithSingleDot = line.startsWith('.');
    if (
      lineStartsWithSingleDot
      && (
        lineEndsWithCaret
        || lineEndsWithCaretVerticalBar
      )
    ) {
      const _domain = line
        .replace('^|', '')
        .replaceAll('^', '')
        .slice(1)
        .trim();

      const domain = normalizeDomain(_domain);
      if (domain) {
        addToBlackList(domain, true);
      } else {
        console.warn('      * [parse-filter E0003] (black) invalid domain:', _domain);
      }
      continue;
    }
    if (
      (
        line.startsWith('://')
        || line.startsWith('http://')
        || line.startsWith('https://')
        || line.startsWith('|http://')
        || line.startsWith('|https://')
      )
      && (
        lineEndsWithCaret
        || lineEndsWithCaretVerticalBar
      )
    ) {
      const _domain = line
        .replace('|https://', '')
        .replace('https://', '')
        .replace('|http://', '')
        .replace('http://', '')
        .replace('://', '')
        .replace('^|', '')
        .replaceAll('^', '')
        .trim();

      const domain = normalizeDomain(_domain);
      if (domain) {
        addToBlackList(domain, false);
      } else {
        console.warn('      * [parse-filter E0004] (black) invalid domain:', _domain);
      }
      continue;
    }
    if (!line.startsWith('|') && lineEndsWithCaret) {
      const _domain = line.slice(0, -1);
      const domain = normalizeDomain(_domain);
      if (domain) {
        addToBlackList(domain, false);
      } else {
        console.warn('      * [parse-filter E0005] (black) invalid domain:', _domain);
      }
      continue;
    }
    const tryNormalizeDomain = normalizeDomain(lineStartsWithSingleDot ? line.slice(1) : line);
    if (
      tryNormalizeDomain
      && (
        lineStartsWithSingleDot
          ? tryNormalizeDomain.length === line.length - 1
          : tryNormalizeDomain === line
      )
    ) {
      addToBlackList(line, true);
      continue;
    }

    if (
      !line.endsWith('.js')
    ) {
      hasParseFailed = true;
      console.warn('      * [parse-filter E0010] can not parse:', line);
    }
  }

  console.timeEnd(`   - processFilterRules: ${filterRulesUrl}`);

  return {
    white: whitelistDomainSets,
    black: blacklistDomainSets,
    foundDebugDomain,
    parseFailed: hasParseFailed
  };
}

/**
 * @param {string[]} data 
 */
function preprocessFullDomainSetBeforeUsedAsWorkerData(data) {
  return data
    .filter(domain => domain[0] === '.')
    .sort((a, b) => a.length - b.length);
}


module.exports.processDomainLists = processDomainLists;
module.exports.processHosts = processHosts;
module.exports.processFilterRules = processFilterRules;
module.exports.preprocessFullDomainSetBeforeUsedAsWorkerData = preprocessFullDomainSetBeforeUsedAsWorkerData;
