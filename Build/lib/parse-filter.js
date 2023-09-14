// @ts-check
const { fetchWithRetry } = require('./fetch-retry');
const { fetchRemoteTextAndCreateReadlineInterface } = require('./fetch-remote-text-by-line');
const { NetworkFilter } = require('@cliqz/adblocker');
const { normalizeDomain } = require('./is-domain-loose');
const { processLine } = require('./process-line');
const { performance } = require('perf_hooks');

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
};

/**
 * @param {string | URL} domainListsUrl
 */
async function processDomainLists(domainListsUrl) {
  if (typeof domainListsUrl === 'string') {
    domainListsUrl = new URL(domainListsUrl);
  }

  /** @type Set<string> */
  const domainSets = new Set();

  for await (const line of await fetchRemoteTextAndCreateReadlineInterface(domainListsUrl)) {
    if (line[0] === '!') {
      continue;
    }

    const domainToAdd = processLine(line);
    if (!domainToAdd) {
      continue;
    }

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

  for await (const l of await fetchRemoteTextAndCreateReadlineInterface(hostsUrl)) {
    const line = processLine(l);
    if (!line) {
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
 * @returns {Promise<{ white: Set<string>, black: Set<string>, foundDebugDomain: boolean }>}
 */
async function processFilterRules(filterRulesUrl, fallbackUrls, includeThirdParties = false) {
  const runStart = performance.now();

  /** @type Set<string> */
  const whitelistDomainSets = new Set();
  /** @type Set<string> */
  const blacklistDomainSets = new Set();

  const __addToBlackList = (domainToBeAddedToBlack, isSubDomain) => {
    if (DEBUG_DOMAIN_TO_FIND && domainToBeAddedToBlack.includes(DEBUG_DOMAIN_TO_FIND)) {
      warnOnce(filterRulesUrl.toString(), false, DEBUG_DOMAIN_TO_FIND);
      foundDebugDomain = true;
    }

    if (isSubDomain && domainToBeAddedToBlack[0] !== '.') {
      blacklistDomainSets.add(`.${domainToBeAddedToBlack}`);
    } else {
      blacklistDomainSets.add(domainToBeAddedToBlack);
    }
  };
  const addToBlackList = DEBUG_DOMAIN_TO_FIND == null
    ? __addToBlackList
    : (domainToBeAddedToBlack, isSubDomain) => {
      if (DEBUG_DOMAIN_TO_FIND && domainToBeAddedToBlack.includes(DEBUG_DOMAIN_TO_FIND)) {
        warnOnce(filterRulesUrl.toString(), false, DEBUG_DOMAIN_TO_FIND);
        foundDebugDomain = true;
      }
      __addToBlackList(domainToBeAddedToBlack, isSubDomain);
    };

  const __addToWhiteList = (domainToBeAddedToWhite) => {
    whitelistDomainSets.add(domainToBeAddedToWhite);
  };
  const addToWhiteList = DEBUG_DOMAIN_TO_FIND == null
    ? __addToWhiteList
    : (domainToBeAddedToWhite) => {
      if (DEBUG_DOMAIN_TO_FIND && domainToBeAddedToWhite.includes(DEBUG_DOMAIN_TO_FIND)) {
        warnOnce(filterRulesUrl.toString(), true, DEBUG_DOMAIN_TO_FIND);
        foundDebugDomain = true;
      }
      __addToWhiteList(domainToBeAddedToWhite);
    };

  let downloadTime = 0;

  const lineCb = (line) => {
    const result = parse(line, includeThirdParties);
    if (result) {
      const flag = result[1];
      const hostname = result[0];
      switch (flag) {
        case 0:
          addToWhiteList(hostname);
          break;
        case 1:
          addToBlackList(hostname, false);
          break;
        case 2:
          addToBlackList(hostname, true);
          break;
        default:
          throw new Error(`Unknown flag: ${flag}`);
      }
    }
  };

  if (!fallbackUrls || fallbackUrls.length === 0) {
    const downloadStart = performance.now();
    for await (const line of await fetchRemoteTextAndCreateReadlineInterface(filterRulesUrl)) {
      lineCb(line.trim());
    }
    downloadTime = performance.now() - downloadStart;
  } else {
    let filterRules;

    const downloadStart = performance.now();
    try {
      const controller = new AbortController();

      /** @type string[] */
      filterRules = (
        await Promise.any(
          [filterRulesUrl, ...(fallbackUrls || [])].map(async url => {
            const text = await fetchWithRetry(url, { signal: controller.signal }).then(r => r.text());
            controller.abort();
            return text;
          })
        )
      ).split('\n').map(line => line.trim());
    } catch (e) {
      console.log(`Download Rule for [${filterRulesUrl}] failed`);
      throw e;
    }
    downloadTime = performance.now() - downloadStart;

    for (let i = 0, len = filterRules.length; i < len; i++) {
      lineCb(filterRules[i].trim());
    }
  }

  console.log(`   ┬ processFilterRules (${filterRulesUrl}): ${(performance.now() - runStart).toFixed(3)}ms`);
  console.log(`   └── download time: ${downloadTime.toFixed(3)}ms`);

  return {
    white: whitelistDomainSets,
    black: blacklistDomainSets,
    foundDebugDomain
  };
}

const R_KNOWN_NOT_NETWORK_FILTER_PATTERN = /[#&%~=]/;
const R_KNOWN_NOT_NETWORK_FILTER_PATTERN_2 = /(\$popup|\$removeparam|\$popunder)/;

/**
 * @param {string} $line
 * @param {boolean} includeThirdParties
 * @returns {null | [string, 0 | 1 | 2]} - 0 white, 1 black abosulte, 2 black include subdomain
 */
function parse($line, includeThirdParties) {
  const line = $line.trim();

  if (
    line === ''
    || line[0] === '/'
    || R_KNOWN_NOT_NETWORK_FILTER_PATTERN.test(line)
    // doesn't include
    || !line.includes('.') // rule with out dot can not be a domain
    // includes
    // || line.includes('#')
    || line.includes('!')
    || line.includes('?')
    || line.includes('*')
    // || line.includes('=')
    || line.includes('[')
    || line.includes('(')
    || line.includes(']')
    || line.includes(')')
    || line.includes(',')
    // || line.includes('~')
    // || line.includes('&')
    // || line.includes('%')
    // ends with
    || line.endsWith('.')
    || line.endsWith('-')
    || line.endsWith('_')
    // special modifier
    || R_KNOWN_NOT_NETWORK_FILTER_PATTERN_2.test(line)
    || ((line.includes('/') || line.includes(':')) && !line.includes('://'))
    // || line.includes('$popup')
    // || line.includes('$removeparam')
    // || line.includes('$popunder')
  ) {
    return null;
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
      return null;
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
          return [hostname, 0];
        }
        if (filter.firstParty() === filter.thirdParty()) {
          return [hostname, 2];
        }
        if (filter.thirdParty()) {
          if (includeThirdParties) {
            return [hostname, 2];
          }
          return null;
        }
        if (filter.firstParty()) {
          return null;
        }
      } else {
        return null;
      }
    }
  }

  if (line.includes('$third-party') || line.includes('$frame')) {
    return null;
  }

  const lineEndsWithCaret = line.endsWith('^');
  const lineEndsWithCaretVerticalBar = line.endsWith('^|');

  if (line[0] === '@' && line[1] === '@') {
    if (line.endsWith('$cname')) {
      return null;
    }

    if (
      // (line.startsWith('@@|') || line.startsWith('@@.'))
      (line[2] === '|' || line[2] === '.')
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
        return [domain, 0];
      }
      console.warn('      * [parse-filter E0001] (black) invalid domain:', _domain);

      return null;
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
      return [domain, 2];
    }
    console.warn('      * [parse-filter E0002] (black) invalid domain:', _domain);

    return null;
  }

  const lineStartsWithSingleDot = line[0] === '.';
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
      return [domain, 2];
    }
    console.warn('      * [parse-filter E0003] (black) invalid domain:', _domain);

    return null;
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
      return [domain, 1];
    }
    console.warn('      * [parse-filter E0004] (black) invalid domain:', _domain);

    return null;
  }
  if (line[0] !== '|' && lineEndsWithCaret) {
    const _domain = line.slice(0, -1);
    const domain = normalizeDomain(_domain);
    if (domain) {
      return [domain, 1];
    }
    console.warn('      * [parse-filter E0005] (black) invalid domain:', _domain);

    return null;
  }
  const tryNormalizeDomain = normalizeDomain(line);
  if (
    tryNormalizeDomain
    && (
      lineStartsWithSingleDot
        ? tryNormalizeDomain.length === line.length - 1
        : tryNormalizeDomain === line
    )
  ) {
    return [line, 2];
  }

  if (!line.endsWith('.js')) {
    console.warn('      * [parse-filter E0010] can not parse:', line);
  }

  return null;
}

module.exports.processDomainLists = processDomainLists;
module.exports.processHosts = processHosts;
module.exports.processFilterRules = processFilterRules;
