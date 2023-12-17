// @ts-check
import { fetchRemoteTextAndReadByLine } from './fetch-text-by-line';
import { NetworkFilter } from '@cliqz/adblocker';
import { processLine } from './process-line';
import { getGorhillPublicSuffixPromise } from './get-gorhill-publicsuffix';
import type { PublicSuffixList } from '@gorhill/publicsuffixlist';

import { traceAsync } from './trace-runner';
import picocolors from 'picocolors';
import { normalizeDomain } from './normalize-domain';
import { fetchAssets } from './fetch-assets';

const DEBUG_DOMAIN_TO_FIND: string | null = null; // example.com | null
let foundDebugDomain = false;

const warnOnceUrl = new Set<string>();
const warnOnce = (url: string, isWhite: boolean, ...message: string[]) => {
  const key = `${url}${isWhite ? 'white' : 'black'}`;
  if (warnOnceUrl.has(key)) {
    return;
  }
  warnOnceUrl.add(key);
  console.warn(url, isWhite ? '(white)' : '(black)', ...message);
};

export function processDomainLists(domainListsUrl: string, includeAllSubDomain = false) {
  return traceAsync(`- processDomainLists: ${domainListsUrl}`, async () => {
    const domainSets = new Set<string>();

    for await (const line of await fetchRemoteTextAndReadByLine(domainListsUrl)) {
      const domainToAdd = processLine(line);
      if (!domainToAdd) continue;

      if (DEBUG_DOMAIN_TO_FIND && domainToAdd.includes(DEBUG_DOMAIN_TO_FIND)) {
        warnOnce(domainListsUrl, false, DEBUG_DOMAIN_TO_FIND);
        foundDebugDomain = true;
      }

      domainSets.add(includeAllSubDomain ? `.${domainToAdd}` : domainToAdd);
    }

    return domainSets;
  });
}

export function processHosts(hostsUrl: string, includeAllSubDomain = false, skipDomainCheck = false) {
  return traceAsync(`- processHosts: ${hostsUrl}`, async () => {
    const domainSets = new Set<string>();

    for await (const l of await fetchRemoteTextAndReadByLine(hostsUrl)) {
      const line = processLine(l);
      if (!line) {
        continue;
      }

      const domain = line.split(/\s/)[1];
      if (!domain) {
        continue;
      }
      const _domain = domain.trim();

      if (DEBUG_DOMAIN_TO_FIND && _domain.includes(DEBUG_DOMAIN_TO_FIND)) {
        warnOnce(hostsUrl, false, DEBUG_DOMAIN_TO_FIND);
        foundDebugDomain = true;
      }

      const domainToAdd = skipDomainCheck ? _domain : normalizeDomain(_domain);
      if (domainToAdd) {
        domainSets.add(includeAllSubDomain ? `.${domainToAdd}` : domainToAdd);
      }
    }

    console.log(picocolors.gray('[process hosts]'), picocolors.gray(hostsUrl), picocolors.gray(domainSets.size));

    return domainSets;
  });
}

// eslint-disable-next-line sukka-ts/no-const-enum -- bun bundler is smart, maybe?
const enum ParseType {
  WhiteIncludeSubdomain = 0,
  WhiteAbsolute = -1,
  BlackAbsolute = 1,
  BlackIncludeSubdomain = 2,
  ErrorMessage = 10
}

export async function processFilterRules(
  filterRulesUrl: string,
  fallbackUrls?: readonly string[] | undefined
): Promise<{ white: Set<string>, black: Set<string>, foundDebugDomain: boolean }> {
  const whitelistDomainSets = new Set<string>();
  const blacklistDomainSets = new Set<string>();

  const warningMessages: string[] = [];

  await traceAsync(`- processFilterRules: ${filterRulesUrl}`, async () => {
    const gorhill = await getGorhillPublicSuffixPromise();

    /**
     * @param {string} line
     */
    const lineCb = (line: string) => {
      const result = parse(line, gorhill);
      if (!result) {
        return;
      }

      const flag = result[1];
      const hostname = result[0];

      if (DEBUG_DOMAIN_TO_FIND) {
        if (hostname.includes(DEBUG_DOMAIN_TO_FIND)) {
          warnOnce(filterRulesUrl, flag === ParseType.WhiteIncludeSubdomain || flag === ParseType.WhiteAbsolute, DEBUG_DOMAIN_TO_FIND);
          foundDebugDomain = true;
        }
      }

      switch (flag) {
        case ParseType.WhiteIncludeSubdomain:
          if (hostname[0] !== '.') {
            whitelistDomainSets.add(`.${hostname}`);
          } else {
            whitelistDomainSets.add(hostname);
          }
          break;
        case ParseType.WhiteAbsolute:
          whitelistDomainSets.add(hostname);
          break;
        case ParseType.BlackAbsolute:
          blacklistDomainSets.add(hostname);
          break;
        case ParseType.BlackIncludeSubdomain:
          if (hostname[0] !== '.') {
            blacklistDomainSets.add(`.${hostname}`);
          } else {
            blacklistDomainSets.add(hostname);
          }
          break;
        case ParseType.ErrorMessage:
          warningMessages.push(hostname);
          break;
        default:
          break;
      }
    };

    if (!fallbackUrls || fallbackUrls.length === 0) {
      for await (const line of await fetchRemoteTextAndReadByLine(filterRulesUrl)) {
        // don't trim here
        lineCb(line);
      }
    } else {
      const filterRules = (await traceAsync(
        picocolors.gray(`- download ${filterRulesUrl}`),
        () => fetchAssets(filterRulesUrl, fallbackUrls),
        picocolors.gray
      )).split('\n');
      for (let i = 0, len = filterRules.length; i < len; i++) {
        lineCb(filterRules[i]);
      }
    }
  });

  warningMessages.forEach(msg => {
    console.warn(
      picocolors.yellow(msg),
      picocolors.gray(picocolors.underline(filterRulesUrl))
    );
  });

  console.log(
    picocolors.gray('[process filter]'),
    picocolors.gray(filterRulesUrl),
    picocolors.gray(`white: ${whitelistDomainSets.size}`),
    picocolors.gray(`black: ${blacklistDomainSets.size}`)
  );

  return {
    white: whitelistDomainSets,
    black: blacklistDomainSets,
    foundDebugDomain
  };
}

const R_KNOWN_NOT_NETWORK_FILTER_PATTERN = /[#%&=~]/;
const R_KNOWN_NOT_NETWORK_FILTER_PATTERN_2 = /(\$popup|\$removeparam|\$popunder|\$cname)/;
// cname exceptional filter can not be parsed by NetworkFilter
// Surge / Clash can't handle CNAME either, so we just ignore them

function parse($line: string, gorhill: PublicSuffixList): null | [hostname: string, flag: ParseType] {
  if (
    // doesn't include
    !$line.includes('.') // rule with out dot can not be a domain
    // includes
    || $line.includes('!')
    || $line.includes('?')
    || $line.includes('*')
    || $line.includes('[')
    || $line.includes('(')
    || $line.includes(']')
    || $line.includes(')')
    || $line.includes(',')
    || R_KNOWN_NOT_NETWORK_FILTER_PATTERN.test($line)
  ) {
    return null;
  }

  const line = $line.trim();

  /** @example line.length */
  const len = line.length;
  if (len === 0) {
    return null;
  }

  const firstCharCode = line[0].charCodeAt(0);
  const lastCharCode = line[len - 1].charCodeAt(0);

  if (
    firstCharCode === 47 // 47 `/`
    // ends with
    || lastCharCode === 46 // 46 `.`, line.endsWith('.')
    || lastCharCode === 45 // 45 `-`, line.endsWith('-')
    || lastCharCode === 95 // 95 `_`, line.endsWith('_')
    // special modifier
    || R_KNOWN_NOT_NETWORK_FILTER_PATTERN_2.test(line)
    // || line.includes('$popup')
    // || line.includes('$removeparam')
    // || line.includes('$popunder')
  ) {
    return null;
  }

  if ((line.includes('/') || line.includes(':')) && !line.includes('://')) {
    return null;
  }

  const filter = NetworkFilter.parse(line);
  if (filter) {
    if (
      // filter.isCosmeticFilter() // always false
      // filter.isNetworkFilter() // always true
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
      filter.hostname // filter.hasHostname() // must have
      && filter.isPlain() // isPlain() === !isRegex()
      && (!filter.isFullRegex())
    ) {
      const hostname = normalizeDomain(filter.hostname);
      if (!hostname) {
        return null;
      }

      //  |: filter.isHostnameAnchor(),
      //  |: filter.isLeftAnchor(),
      //  |https://: !filter.isHostnameAnchor() && (filter.fromHttps() || filter.fromHttp())
      const isIncludeAllSubDomain = filter.isHostnameAnchor();

      if (filter.isException() || filter.isBadFilter()) {
        return [hostname, isIncludeAllSubDomain ? ParseType.WhiteIncludeSubdomain : ParseType.WhiteAbsolute];
      }

      const _1p = filter.firstParty();
      const _3p = filter.thirdParty();

      if (_1p) {
        if (_1p === _3p) {
          return [hostname, isIncludeAllSubDomain ? ParseType.BlackIncludeSubdomain : ParseType.BlackAbsolute];
        }
        return null;
      }
      if (_3p) {
        return null;
      }
    }
  }

  // After NetworkFilter.parse, it means the line can not be parsed by cliqz NetworkFilter
  // We now need to "salvage" the line as much as possible

  /*
   * From now on, we are mostly facing non-standard domain rules (some are regex like)
   * We first skip third-party and frame rules, as Surge / Clash can't handle them
   *
   * `.sharecounter.$third-party`
   * `.bbelements.com^$third-party`
   * `://o0e.ru^$third-party`
   * `.1.1.1.l80.js^$third-party`
   */
  if (line.includes('$third-party') || line.includes('$frame')) {
    return null;
  }

  /** @example line.endsWith('^') */
  const linedEndsWithCaret = lastCharCode === 94; // lastChar === '^';
  /** @example line.endsWith('^|') */
  const lineEndsWithCaretVerticalBar = (lastCharCode === 124 /** lastChar === '|' */) && line[len - 2] === '^';
  /** @example line.endsWith('^') || line.endsWith('^|') */
  const lineEndsWithCaretOrCaretVerticalBar = linedEndsWithCaret || lineEndsWithCaretVerticalBar;

  // whitelist (exception)
  if (
    firstCharCode === 64 // 64 `@`
    && line[1] === '@'
  ) {
    /**
     * Some "malformed" regex-based filters can not be parsed by NetworkFilter
     * "$genericblock`" is also not supported by NetworkFilter, see:
     *  https://github.com/ghostery/adblocker/blob/62caf7786ba10ef03beffecd8cd4eec111bcd5ec/packages/adblocker/test/parsing.test.ts#L950
     *
     * `@@||cmechina.net^$genericblock`
     * `@@|ftp.bmp.ovh^|`
     * `@@|adsterra.com^|`
     * `@@.atlassian.net$document`
     * `@@||ad.alimama.com^$genericblock`
     */

    let sliceStart = 0;
    let sliceEnd: number | undefined;

    // line.startsWith('@@|') || line.startsWith('@@.')
    if (line[2] === '|' || line[2] === '.') {
      sliceStart = 3;
      // line.startsWith('@@||')
      if (line[3] === '|') {
        sliceStart = 4;
      }
    }

    /**
     * line.startsWith('@@://')
     *
     * `@@://googleadservices.com^|`
     * `@@://www.googleadservices.com^|`
     */
    if (line[2] === ':' && line[3] === '/' && line[4] === '/') {
      sliceStart = 5;
    }

    if (lineEndsWithCaretOrCaretVerticalBar) {
      sliceEnd = -2;
    } else if (line.endsWith('$genericblock')) {
      sliceEnd = -13;
      if (line[len - 14] === '^') { // line.endsWith('^$genericblock')
        sliceEnd = -14;
      }
    } else if (line.endsWith('$document')) {
      sliceEnd = -9;
      if (line[len - 10] === '^') { // line.endsWith('^$document')
        sliceEnd = -10;
      }
    }

    if (sliceStart !== 0 || sliceEnd !== undefined) {
      const sliced = line.slice(sliceStart, sliceEnd);
      const domain = normalizeDomain(sliced);
      if (domain) {
        return [domain, ParseType.WhiteIncludeSubdomain];
      }
      return [
        `[parse-filter E0001] (white) invalid domain: ${JSON.stringify({
          line, sliced, sliceStart, sliceEnd
        })}`,
        ParseType.ErrorMessage
      ];
    }

    return [
      `[parse-filter E0006] (white) failed to parse: ${JSON.stringify({
        line, sliceStart, sliceEnd
      })}`,
      ParseType.ErrorMessage
    ];
  }

  if (firstCharCode === 124) { // 124 `|`
    if (lineEndsWithCaretOrCaretVerticalBar) {
      /**
       * Some malformed filters can not be parsed by NetworkFilter:
       *
       * `||smetrics.teambeachbody.com^.com^`
       * `||solutions.|pages.indigovision.com^`
       * `||vystar..0rg@client.iebetanialaargentina.edu.co^`
       * `app-uat.latrobehealth.com.au^predirect.snapdeal.com`
       */

      const includeAllSubDomain = line[1] === '|';

      const sliceStart = includeAllSubDomain ? 2 : 1;
      const sliceEnd = lastCharCode === 94 // lastChar === '^'
        ? -1
        : (lineEndsWithCaretVerticalBar
          ? -2
          : undefined);

      const _domain = line
        .slice(sliceStart, sliceEnd) // we already make sure line startsWith "|"
        .trim();

      const domain = normalizeDomain(_domain);
      if (domain) {
        return [domain, includeAllSubDomain ? ParseType.BlackIncludeSubdomain : ParseType.BlackAbsolute];
      }

      return [
        `[parse-filter E0002] (black) invalid domain: ${_domain}`,
        ParseType.ErrorMessage
      ];
    }
  }

  const lineStartsWithSingleDot = firstCharCode === 46; // 46 `.`
  if (
    lineStartsWithSingleDot
    && lineEndsWithCaretOrCaretVerticalBar
  ) {
    /**
     * `.ay.delivery^`
     * `.m.bookben.com^`
     * `.wap.x4399.com^`
     */
    const _domain = line.slice(
      1, // remove prefix dot
      linedEndsWithCaret // replaceAll('^', '')
        ? -1
        : (lineEndsWithCaretVerticalBar ? -2 : 0) // replace('^|', '')
    );

    const suffix = gorhill.getPublicSuffix(_domain);
    if (!gorhill.suffixInPSL(suffix)) {
      // This exclude domain-like resource like `1.1.4.514.js`
      return null;
    }

    const domain = normalizeDomain(_domain);
    if (domain) {
      return [domain, ParseType.BlackIncludeSubdomain];
    }

    return [
      `[paparse-filter E0003] (black) invalid domain: ${_domain}`,
      ParseType.ErrorMessage
    ];
  }

  /**
 * `|http://x.o2.pl^`
 * `://mine.torrent.pw^`
 * `://say.ac^`
 */
  if (
    (
      line.startsWith('://')
      || line.startsWith('http://')
      || line.startsWith('https://')
      || line.startsWith('|http://')
      || line.startsWith('|https://')
    )
    && lineEndsWithCaretOrCaretVerticalBar
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
      return [domain, ParseType.BlackAbsolute];
    }

    return [
      `[parse-filter E0004] (black) invalid domain: ${_domain}`,
      ParseType.ErrorMessage
    ];
  }

  /**
 * `_vmind.qqvideo.tc.qq.com^`
 * `arketing.indianadunes.com^`
 * `charlestownwyllie.oaklawnnonantum.com^`
 * `-telemetry.officeapps.live.com^`
 * `-tracker.biliapi.net`
 * `-logging.nextmedia.com`
 * `_social_tracking.js^`
 */
  if (
    firstCharCode !== 124 // 124 `|`
    && lastCharCode === 94 // 94 `^`
  ) {
    const _domain = line.slice(0, -1);

    const suffix = gorhill.getPublicSuffix(_domain);
    if (!suffix || !gorhill.suffixInPSL(suffix)) {
      // This exclude domain-like resource like `_social_tracking.js^`
      return null;
    }

    const domain = normalizeDomain(_domain);
    if (domain) {
      return [domain, ParseType.BlackAbsolute];
    }

    return [
      `[parse-filter E0005] (black) invalid domain: ${_domain}`,
      ParseType.ErrorMessage
    ];
  }

  if (lineStartsWithSingleDot) {
    /**
     * `.cookielaw.js`
     * `.content_tracking.js`
     * `.ads.css`
     */
    const _domain = line.slice(1);

    const suffix = gorhill.getPublicSuffix(_domain);
    if (!suffix || !gorhill.suffixInPSL(suffix)) {
      // This exclude domain-like resource like `.gatracking.js`, `.beacon.min.js` and `.cookielaw.js`
      return null;
    }

    const tryNormalizeDomain = normalizeDomain(_domain);
    if (tryNormalizeDomain === _domain) {
      // the entire rule is domain
      return [line, ParseType.BlackIncludeSubdomain];
    }
  } else {
    /**
     * `_prebid.js`
     * `t.yesware.com`
     * `ubmcmm.baidustatic.com`
     * `://www.smfg-card.$document`
     * `portal.librus.pl$$advertisement-module`
     * `@@-ds.metric.gstatic.com^|`
     * `://gom.ge/cookie.js`
     * `://accout-update-smba.jp.$document`
     * `_200x250.png`
     * `@@://www.liquidweb.com/kb/wp-content/themes/lw-kb-theme/images/ads/vps-sidebar.jpg`
     */
    const tryNormalizeDomain = normalizeDomain(line);
    if (tryNormalizeDomain === line) {
      // the entire rule is domain
      return [line, ParseType.BlackIncludeSubdomain];
    }
  }

  return [
    `[parse-filter E0010] can not parse: ${line}`,
    ParseType.ErrorMessage
  ];
}
