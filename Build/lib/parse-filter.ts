// @ts-check
import { fetchRemoteTextByLine } from './fetch-text-by-line';
import { NetworkFilter } from '@cliqz/adblocker';
import { processLine } from './process-line';
import { getGorhillPublicSuffixPromise } from './get-gorhill-publicsuffix';
import type { PublicSuffixList } from '@gorhill/publicsuffixlist';

import picocolors from 'picocolors';
import { normalizeDomain } from './normalize-domain';
import { fetchAssets } from './fetch-assets';
import { deserializeSet, fsCache, serializeSet } from './cache-filesystem';
import type { Span } from '../trace';

const DEBUG_DOMAIN_TO_FIND: string | null = null; // example.com | null
let foundDebugDomain = false;

export function processDomainLists(span: Span, domainListsUrl: string, includeAllSubDomain = false, ttl: number | null = null) {
  return span.traceChild(`process domainlist: ${domainListsUrl}`).traceAsyncFn(() => fsCache.apply(
    domainListsUrl,
    async () => {
      const domainSets = new Set<string>();

      for await (const line of await fetchRemoteTextByLine(domainListsUrl)) {
        let domainToAdd = processLine(line);
        if (!domainToAdd) continue;
        domainToAdd = normalizeDomain(domainToAdd);
        if (!domainToAdd) continue;

        if (DEBUG_DOMAIN_TO_FIND && domainToAdd.includes(DEBUG_DOMAIN_TO_FIND)) {
          console.warn(picocolors.red(domainListsUrl), '(black)', domainToAdd.replaceAll(DEBUG_DOMAIN_TO_FIND, picocolors.bold(DEBUG_DOMAIN_TO_FIND)));
          foundDebugDomain = true;
        }

        domainSets.add(includeAllSubDomain ? `.${domainToAdd}` : domainToAdd);
      }

      return domainSets;
    },
    {
      ttl,
      temporaryBypass: DEBUG_DOMAIN_TO_FIND !== null,
      serializer: serializeSet,
      deserializer: deserializeSet
    }
  ));
}
export function processHosts(span: Span, hostsUrl: string, mirrors: string[] | null, includeAllSubDomain = false, ttl: number | null = null) {
  return span.traceChild(`processhosts: ${hostsUrl}`).traceAsyncFn((childSpan) => fsCache.apply(
    hostsUrl,
    async () => {
      const domainSets = new Set<string>();

      const lineCb = (l: string) => {
        const line = processLine(l);
        if (!line) {
          return;
        }

        const _domain = line.split(/\s/)[1]?.trim();
        if (!_domain) {
          return;
        }
        const domain = normalizeDomain(_domain);
        if (!domain) {
          return;
        }
        if (DEBUG_DOMAIN_TO_FIND && domain.includes(DEBUG_DOMAIN_TO_FIND)) {
          console.warn(picocolors.red(hostsUrl), '(black)', domain.replaceAll(DEBUG_DOMAIN_TO_FIND, picocolors.bold(DEBUG_DOMAIN_TO_FIND)));
          foundDebugDomain = true;
        }

        domainSets.add(includeAllSubDomain ? `.${domain}` : domain);
      };

      if (mirrors == null || mirrors.length === 0) {
        for await (const l of await fetchRemoteTextByLine(hostsUrl)) {
          lineCb(l);
        }
      } else {
        // Avoid event loop starvation, so we wait for a macrotask before we start fetching.
        await Promise.resolve();

        const filterRules = await childSpan.traceChild('download hosts').traceAsyncFn(() => {
          return fetchAssets(hostsUrl, mirrors).then(text => text.split('\n'));
        });

        childSpan.traceChild('parse hosts').traceSyncFn(() => {
          for (let i = 0, len = filterRules.length; i < len; i++) {
            lineCb(filterRules[i]);
          }
        });
      }

      console.log(picocolors.gray('[process hosts]'), picocolors.gray(hostsUrl), picocolors.gray(domainSets.size));

      return domainSets;
    },
    {
      ttl,
      temporaryBypass: DEBUG_DOMAIN_TO_FIND !== null,
      serializer: serializeSet,
      deserializer: deserializeSet
    }
  ));
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
  parentSpan: Span,
  filterRulesUrl: string,
  fallbackUrls?: readonly string[] | undefined | null,
  ttl: number | null = null
): Promise<{ white: string[], black: string[], foundDebugDomain: boolean }> {
  const [white, black, warningMessages] = await parentSpan.traceChild(`process filter rules: ${filterRulesUrl}`).traceAsyncFn((span) => fsCache.apply<Readonly<[
    white: string[],
    black: string[],
    warningMessages: string[]
  ]>>(
    filterRulesUrl,
    async () => {
      const whitelistDomainSets = new Set<string>();
      const blacklistDomainSets = new Set<string>();

      const warningMessages: string[] = [];

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
            console.warn(
              picocolors.red(filterRulesUrl),
              flag === ParseType.WhiteIncludeSubdomain || flag === ParseType.WhiteAbsolute
                ? '(white)'
                : '(black)',
              hostname.replaceAll(DEBUG_DOMAIN_TO_FIND, picocolors.bold(DEBUG_DOMAIN_TO_FIND))
            );
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

      // TODO-SUKKA: add cache here
      if (!fallbackUrls || fallbackUrls.length === 0) {
        for await (const line of await fetchRemoteTextByLine(filterRulesUrl)) {
          // don't trim here
          lineCb(line);
        }
      } else {
        // Avoid event loop starvation, so we wait for a macrotask before we start fetching.
        await Promise.resolve();

        const filterRules = await span.traceChild('download adguard filter').traceAsyncFn(() => {
          return fetchAssets(filterRulesUrl, fallbackUrls).then(text => text.split('\n'));
        });

        span.traceChild('parse adguard filter').traceSyncFn(() => {
          for (let i = 0, len = filterRules.length; i < len; i++) {
            lineCb(filterRules[i]);
          }
        });
      }

      return [
        Array.from(whitelistDomainSets),
        Array.from(blacklistDomainSets),
        warningMessages
      ] as const;
    },
    {
      ttl,
      temporaryBypass: DEBUG_DOMAIN_TO_FIND !== null,
      serializer: JSON.stringify,
      deserializer: JSON.parse
    }
  ));

  for (let i = 0, len = warningMessages.length; i < len; i++) {
    console.warn(
      picocolors.yellow(warningMessages[i]),
      picocolors.gray(picocolors.underline(filterRulesUrl))
    );
  }

  console.log(
    picocolors.gray('[process filter]'),
    picocolors.gray(filterRulesUrl),
    picocolors.gray(`white: ${white.length}`),
    picocolors.gray(`black: ${black.length}`)
  );

  return {
    white,
    black,
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
  const lineEndsWithCaret = lastCharCode === 94; // lastChar === '^';
  /** @example line.endsWith('^|') */
  const lineEndsWithCaretVerticalBar = (lastCharCode === 124 /** lastChar === '|' */) && line[len - 2] === '^';
  /** @example line.endsWith('^') || line.endsWith('^|') */
  const lineEndsWithCaretOrCaretVerticalBar = lineEndsWithCaret || lineEndsWithCaretVerticalBar;

  // whitelist (exception)
  if (
    firstCharCode === 64 // 64 `@`
    && line[1] === '@'
  ) {
    let whiteIncludeAllSubDomain = true;

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

    if (line[2] === '|') { // line.startsWith('@@|')
      sliceStart = 3;
      whiteIncludeAllSubDomain = false;

      if (line[3] === '|') { // line.startsWith('@@||')
        sliceStart = 4;
        whiteIncludeAllSubDomain = true;
      }
    } else if (line[2] === '.') { // line.startsWith('@@.')
      sliceStart = 3;
      whiteIncludeAllSubDomain = true;
    } else if (
      /**
       * line.startsWith('@@://')
       *
       * `@@://googleadservices.com^|`
       * `@@://www.googleadservices.com^|`
       */
      line[2] === ':' && line[3] === '/' && line[4] === '/'
    ) {
      whiteIncludeAllSubDomain = false;
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
        return [domain, whiteIncludeAllSubDomain ? ParseType.WhiteIncludeSubdomain : ParseType.WhiteAbsolute];
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

  if (
    // 124 `|`
    // line.startsWith('|')
    firstCharCode === 124
    && lineEndsWithCaretOrCaretVerticalBar
  ) {
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
    const sliceEnd = lineEndsWithCaret
      ? -1
      : (lineEndsWithCaretVerticalBar ? -2 : undefined);

    const sliced = line.slice(sliceStart, sliceEnd); // we already make sure line startsWith "|"

    const domain = normalizeDomain(sliced);
    if (domain) {
      return [domain, includeAllSubDomain ? ParseType.BlackIncludeSubdomain : ParseType.BlackAbsolute];
    }

    return [
      `[parse-filter E0002] (black) invalid domain: ${sliced}`,
      ParseType.ErrorMessage
    ];
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
    const sliced = line.slice(
      1, // remove prefix dot
      lineEndsWithCaret // replaceAll('^', '')
        ? -1
        : (lineEndsWithCaretVerticalBar ? -2 : undefined) // replace('^|', '')
    );

    const suffix = gorhill.getPublicSuffix(sliced);
    if (!gorhill.suffixInPSL(suffix)) {
      // This exclude domain-like resource like `1.1.4.514.js`
      return null;
    }

    const domain = normalizeDomain(sliced);
    if (domain) {
      return [domain, ParseType.BlackIncludeSubdomain];
    }

    return [
      `[paparse-filter E0003] (black) invalid domain: ${sliced}`,
      ParseType.ErrorMessage
    ];
  }

  /**
   * `|http://x.o2.pl^`
   * `://mine.torrent.pw^`
   * `://say.ac^`
   */
  if (lineEndsWithCaretOrCaretVerticalBar) {
    let sliceStart = 0;
    let sliceEnd;
    if (lineEndsWithCaret) { // line.endsWith('^')
      sliceEnd = -1;
    } else if (lineEndsWithCaretVerticalBar) { // line.endsWith('^|')
      sliceEnd = -2;
    }
    if (line.startsWith('://')) {
      sliceStart = 3;
    } else if (line.startsWith('http://')) {
      sliceStart = 7;
    } else if (line.startsWith('https://')) {
      sliceStart = 8;
    } else if (line.startsWith('|http://')) {
      sliceStart = 8;
    } else if (line.startsWith('|https://')) {
      sliceStart = 9;
    }

    if (sliceStart !== 0 || sliceEnd !== undefined) {
      const sliced = line.slice(sliceStart, sliceEnd);
      const domain = normalizeDomain(sliced);
      if (domain) {
        return [domain, ParseType.BlackIncludeSubdomain];
      }
      return [
        `[parse-filter E0004] (black) invalid domain: ${JSON.stringify({
          line, sliced, sliceStart, sliceEnd
        })}`,
        ParseType.ErrorMessage
      ];
    }
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

  // Possibly that entire rule is domain

  /**
   * lineStartsWithSingleDot:
   *
   * `.cookielaw.js`
   * `.content_tracking.js`
   * `.ads.css`
   *
   * else:
   *
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
  let sliceStart = 0;
  let sliceEnd: number | undefined;
  if (lineStartsWithSingleDot) {
    sliceStart = 1;
  }
  if (line.endsWith('^$all')) { // This salvage line `thepiratebay3.com^$all`
    sliceEnd = -5;
  } else if (
    // Try to salvage line like `://account.smba.$document`
    // For this specific line, it will fail anyway though.
    line.endsWith('$document')
  ) {
    sliceEnd = -9;
  }
  const sliced = (sliceStart !== 0 || sliceEnd !== undefined) ? line.slice(sliceStart, sliceEnd) : line;
  const suffix = gorhill.getPublicSuffix(sliced);
  /**
   * Fast exclude definitely not domain-like resource
   *
   * `.gatracking.js`, suffix is `js`,
   * `.ads.css`, suffix is `css`,
   * `-cpm-ads.$badfilter`, suffix is `$badfilter`,
   * `portal.librus.pl$$advertisement-module`, suffix is `pl$$advertisement-module`
   */
  if (!suffix || !gorhill.suffixInPSL(suffix)) {
    // This exclude domain-like resource like `.gatracking.js`, `.beacon.min.js` and `.cookielaw.js`
    return null;
  }

  const tryNormalizeDomain = normalizeDomain(sliced);
  if (tryNormalizeDomain === sliced) {
    // the entire rule is domain
    return [sliced, ParseType.BlackIncludeSubdomain];
  }

  return [
    `[parse-filter E0010] can not parse: ${line}`,
    ParseType.ErrorMessage
  ];
}
