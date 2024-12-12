import { NetworkFilter } from '@ghostery/adblocker';
import { processLine } from './process-line';
import tldts from 'tldts-experimental';

import picocolors from 'picocolors';
import { normalizeDomain } from './normalize-domain';
import { deserializeArray, fsFetchCache, serializeArray, getFileContentHash } from './cache-filesystem';
import type { Span } from '../trace';
import { createAhoCorasick as createKeywordFilter } from 'foxts/ahocorasick';
import { looseTldtsOpt } from '../constants/loose-tldts-opt';
import { identity } from 'foxts/identity';
import { DEBUG_DOMAIN_TO_FIND } from '../constants/reject-data-source';

let foundDebugDomain = false;
const temporaryBypass = typeof DEBUG_DOMAIN_TO_FIND === 'string';

function domainListLineCb(l: string, set: string[], includeAllSubDomain: boolean, meta: string) {
  let line = processLine(l);
  if (!line) return;
  line = line.toLowerCase();

  const domain = normalizeDomain(line);
  if (!domain) return;
  if (domain !== line) {
    console.log(
      picocolors.red('[process domain list]'),
      picocolors.gray(`line: ${line}`),
      picocolors.gray(`domain: ${domain}`),
      picocolors.gray(meta)
    );

    return;
  }

  if (DEBUG_DOMAIN_TO_FIND && line.includes(DEBUG_DOMAIN_TO_FIND)) {
    console.warn(picocolors.red(meta), '(black)', line.replaceAll(DEBUG_DOMAIN_TO_FIND, picocolors.bold(DEBUG_DOMAIN_TO_FIND)));
    foundDebugDomain = true;
  }

  set.push(includeAllSubDomain ? `.${line}` : line);
}

export function processDomainLists(
  span: Span,
  domainListsUrl: string, mirrors: string[] | null, includeAllSubDomain = false,
  ttl: number | null = null, extraCacheKey: (input: string) => string = identity
) {
  return span.traceChild(`process domainlist: ${domainListsUrl}`).traceAsyncFn((childSpan) => fsFetchCache.applyWithHttp304AndMirrors<string[]>(
    domainListsUrl,
    mirrors ?? [],
    extraCacheKey(getFileContentHash(__filename)),
    (text) => {
      const domainSets: string[] = [];
      const filterRules = text.split('\n');

      childSpan.traceChild('parse domain list').traceSyncFn(() => {
        for (let i = 0, len = filterRules.length; i < len; i++) {
          domainListLineCb(filterRules[i], domainSets, includeAllSubDomain, domainListsUrl);
        }
      });

      return domainSets;
    },
    {
      ttl,
      temporaryBypass,
      serializer: serializeArray,
      deserializer: deserializeArray
    }
  ));
}

function hostsLineCb(l: string, set: string[], includeAllSubDomain: boolean, meta: string) {
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
    console.warn(picocolors.red(meta), '(black)', domain.replaceAll(DEBUG_DOMAIN_TO_FIND, picocolors.bold(DEBUG_DOMAIN_TO_FIND)));
    foundDebugDomain = true;
  }

  set.push(includeAllSubDomain ? `.${domain}` : domain);
}

export function processHosts(
  span: Span,
  hostsUrl: string, mirrors: string[] | null, includeAllSubDomain = false,
  ttl: number | null = null, extraCacheKey: (input: string) => string = identity
) {
  return span.traceChild(`processhosts: ${hostsUrl}`).traceAsyncFn((childSpan) => fsFetchCache.applyWithHttp304AndMirrors<string[]>(
    hostsUrl,
    mirrors ?? [],
    extraCacheKey(getFileContentHash(__filename)),
    (text) => {
      const domainSets: string[] = [];

      const filterRules = text.split('\n');

      childSpan.traceChild('parse hosts').traceSyncFn(() => {
        for (let i = 0, len = filterRules.length; i < len; i++) {
          hostsLineCb(filterRules[i], domainSets, includeAllSubDomain, hostsUrl);
        }
      });

      return domainSets;
    },
    {
      ttl,
      temporaryBypass,
      serializer: serializeArray,
      deserializer: deserializeArray
    }
  ));
}

const enum ParseType {
  WhiteIncludeSubdomain = 0,
  WhiteAbsolute = -1,
  BlackAbsolute = 1,
  BlackIncludeSubdomain = 2,
  ErrorMessage = 10,
  Null = 1000,
  NotParsed = 2000
}

export { type ParseType };

export async function processFilterRules(
  parentSpan: Span,
  filterRulesUrl: string,
  fallbackUrls?: string[] | null,
  ttl: number | null = null,
  allowThirdParty = false
): Promise<{ white: string[], black: string[], foundDebugDomain: boolean }> {
  const [white, black, warningMessages] = await parentSpan.traceChild(`process filter rules: ${filterRulesUrl}`).traceAsyncFn((span) => fsFetchCache.applyWithHttp304AndMirrors<Readonly<[white: string[], black: string[], warningMessages: string[]]>>(
    filterRulesUrl,
    fallbackUrls ?? [],
    getFileContentHash(__filename),
    (text) => {
      const whitelistDomainSets = new Set<string>();
      const blacklistDomainSets = new Set<string>();

      const warningMessages: string[] = [];

      const MUTABLE_PARSE_LINE_RESULT: [string, ParseType] = ['', ParseType.NotParsed];
      /**
       * @param {string} line
       */
      const lineCb = (line: string) => {
        const result = parse(line, MUTABLE_PARSE_LINE_RESULT, allowThirdParty);
        const flag = result[1];

        if (flag === ParseType.NotParsed) {
          throw new Error(`Didn't parse line: ${line}`);
        }
        if (flag === ParseType.Null) {
          return;
        }

        const hostname = result[0];

        if (DEBUG_DOMAIN_TO_FIND && hostname.includes(DEBUG_DOMAIN_TO_FIND)) {
          console.warn(
            picocolors.red(filterRulesUrl),
            flag === ParseType.WhiteIncludeSubdomain || flag === ParseType.WhiteAbsolute
              ? '(white)'
              : '(black)',
            hostname.replaceAll(DEBUG_DOMAIN_TO_FIND, picocolors.bold(DEBUG_DOMAIN_TO_FIND))
          );
          foundDebugDomain = true;
        }

        switch (flag) {
          case ParseType.WhiteIncludeSubdomain:
            if (hostname[0] === '.') {
              whitelistDomainSets.add(hostname);
            } else {
              whitelistDomainSets.add(`.${hostname}`);
            }
            break;
          case ParseType.WhiteAbsolute:
            whitelistDomainSets.add(hostname);
            break;
          case ParseType.BlackIncludeSubdomain:
            if (hostname[0] === '.') {
              blacklistDomainSets.add(hostname);
            } else {
              blacklistDomainSets.add(`.${hostname}`);
            }
            break;
          case ParseType.BlackAbsolute:
            blacklistDomainSets.add(hostname);
            break;
          case ParseType.ErrorMessage:
            warningMessages.push(hostname);
            break;
          default:
            break;
        }
      };

      const filterRules = text.split('\n');

      span.traceChild('parse adguard filter').traceSyncFn(() => {
        for (let i = 0, len = filterRules.length; i < len; i++) {
          lineCb(filterRules[i]);
        }
      });

      return [
        Array.from(whitelistDomainSets),
        Array.from(blacklistDomainSets),
        warningMessages
      ] as const;
    },
    {
      ttl,
      temporaryBypass,
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

// const R_KNOWN_NOT_NETWORK_FILTER_PATTERN_2 = /(\$popup|\$removeparam|\$popunder|\$cname)/;
// cname exceptional filter can not be parsed by NetworkFilter
// Surge / Clash can't handle CNAME either, so we just ignore them

const kwfilter = createKeywordFilter([
  '!',
  '?',
  '*',
  '[',
  '(',
  ']',
  ')',
  ',',
  '#',
  '%',
  '&',
  '=',
  '~',
  // special modifier
  '$popup',
  '$removeparam',
  '$popunder',
  '$cname',
  '$frame',
  // some bad syntax
  '^popup'
]);

export function parse($line: string, result: [string, ParseType], allowThirdParty: boolean): [hostname: string, flag: ParseType] {
  if (
    // doesn't include
    !$line.includes('.') // rule with out dot can not be a domain
    // includes
    || kwfilter($line)
  ) {
    result[1] = ParseType.Null;
    return result;
  }

  let line = $line.trim();

  /** @example line.length */
  const len = line.length;
  if (len === 0) {
    result[1] = ParseType.Null;
    return result;
  }

  const firstCharCode = line[0].charCodeAt(0);
  const lastCharCode = line[len - 1].charCodeAt(0);

  if (
    firstCharCode === 47 // 47 `/`
    // ends with
    || lastCharCode === 46 // 46 `.`, line.endsWith('.')
    || lastCharCode === 45 // 45 `-`, line.endsWith('-')
    || lastCharCode === 95 // 95 `_`, line.endsWith('_')
    // || line.includes('$popup')
    // || line.includes('$removeparam')
    // || line.includes('$popunder')
  ) {
    result[1] = ParseType.Null;
    return result;
  }

  if ((line.includes('/') || line.includes(':')) && !line.includes('://')) {
    result[1] = ParseType.Null;
    return result;
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
      || (!filter.fromHttp() && !filter.fromHttps())
    ) {
      // not supported type
      result[1] = ParseType.Null;
      return result;
    }

    if (
      !filter.fromAny()
      // $image, $websocket, $xhr this are all non-any
      && !filter.fromDocument() // $document, $doc
      // && !filter.fromSubdocument() // $subdocument, $subdoc
    ) {
      result[1] = ParseType.Null;
      return result;
    }

    if (
      filter.hostname // filter.hasHostname() // must have
      && filter.isPlain() // isPlain() === !isRegex()
      && (!filter.isFullRegex())
    ) {
      const hostname = normalizeDomain(filter.hostname);
      if (!hostname) {
        result[1] = ParseType.Null;
        return result;
      }

      //  |: filter.isHostnameAnchor(),
      //  |: filter.isLeftAnchor(),
      //  |https://: !filter.isHostnameAnchor() && (filter.fromHttps() || filter.fromHttp())
      const isIncludeAllSubDomain = filter.isHostnameAnchor();

      if (filter.isException() || filter.isBadFilter()) {
        result[0] = hostname;
        result[1] = isIncludeAllSubDomain ? ParseType.WhiteIncludeSubdomain : ParseType.WhiteAbsolute;
        return result;
      }

      const _1p = filter.firstParty();
      const _3p = filter.thirdParty();

      if (_1p) { // first party is true
        if (_3p) { // third party is also true
          result[0] = hostname;
          result[1] = isIncludeAllSubDomain ? ParseType.BlackIncludeSubdomain : ParseType.BlackAbsolute;

          return result;
        }
        result[1] = ParseType.Null;
        return result;
      }
      if (_3p) {
        if (allowThirdParty) {
          result[0] = hostname;
          result[1] = isIncludeAllSubDomain ? ParseType.BlackIncludeSubdomain : ParseType.BlackAbsolute;
          return result;
        }
        result[1] = ParseType.Null;
        return result;
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
  if (line.includes('$third-party')) {
    if (!allowThirdParty) {
      result[1] = ParseType.Null;
      return result;
    }

    line = line
      .replace('$third-party,', '$')
      .replace('$third-party', '');
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

    switch (line[2]) {
      case '|':
        // line.startsWith('@@|')
        sliceStart = 3;
        whiteIncludeAllSubDomain = false;

        if (line[3] === '|') { // line.startsWith('@@||')
          sliceStart = 4;
          whiteIncludeAllSubDomain = true;
        }

        break;

      case '.': { // line.startsWith('@@.')
        sliceStart = 3;
        whiteIncludeAllSubDomain = true;
        break;
      }

      case ':': {
        /**
         * line.startsWith('@@://')
         *
         * `@@://googleadservices.com^|`
         * `@@://www.googleadservices.com^|`
         */
        if (line[3] === '/' && line[4] === '/') {
          whiteIncludeAllSubDomain = false;
          sliceStart = 5;
        }
        break;
      }

      default:
        break;
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
        result[0] = domain;
        result[1] = whiteIncludeAllSubDomain ? ParseType.WhiteIncludeSubdomain : ParseType.WhiteAbsolute;
        return result;
      }

      result[0] = `[parse-filter E0001] (white) invalid domain: ${JSON.stringify({
        line, sliced, sliceStart, sliceEnd, domain
      })}`;
      result[1] = ParseType.ErrorMessage;
      return result;
    }

    result[0] = `[parse-filter E0006] (white) failed to parse: ${JSON.stringify({
      line, sliceStart, sliceEnd
    })}`;
    result[1] = ParseType.ErrorMessage;
    return result;
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
      result[0] = domain;
      result[1] = includeAllSubDomain ? ParseType.BlackIncludeSubdomain : ParseType.BlackAbsolute;
      return result;
    }

    result[0] = `[parse-filter E0002] (black) invalid domain: ${sliced}`;
    result[1] = ParseType.ErrorMessage;
    return result;
  }

  // if (line.endsWith('$image')) {
  //   /**
  //    * Some $image filters are not NetworkFilter:
  //    *
  //    * `app.site123.com$image`
  //    * `t.signaux$image`
  //    * `track.customer.io$image`
  //    */
  // }

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

    const suffix = tldts.getPublicSuffix(sliced, looseTldtsOpt);
    if (!suffix) {
      // This exclude domain-like resource like `1.1.4.514.js`
      result[1] = ParseType.Null;
      return result;
    }

    const domain = normalizeDomain(sliced);
    if (domain) {
      result[0] = domain;
      result[1] = ParseType.BlackIncludeSubdomain;
      return result;
    }

    result[0] = `[parse-filter E0003] (black) invalid domain: ${JSON.stringify({ sliced, domain })}`;
    result[1] = ParseType.ErrorMessage;
    return result;
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
        result[0] = domain;
        result[1] = ParseType.BlackIncludeSubdomain;
        return result;
      }

      result[0] = `[parse-filter E0004] (black) invalid domain: ${JSON.stringify({
        line, sliced, sliceStart, sliceEnd, domain
      })}`;
      result[1] = ParseType.ErrorMessage;
      return result;
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

    const suffix = tldts.getPublicSuffix(_domain, looseTldtsOpt);
    if (!suffix) {
      // This exclude domain-like resource like `_social_tracking.js^`
      result[1] = ParseType.Null;
      return result;
    }

    const domain = normalizeDomain(_domain);
    if (domain) {
      result[0] = domain;
      result[1] = ParseType.BlackAbsolute;
      return result;
    }

    result[0] = `[parse-filter E0005] (black) invalid domain: ${_domain}`;
    result[1] = ParseType.ErrorMessage;
    return result;
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
  } else if (line.endsWith('$badfilter')) {
    sliceEnd = -10;
  }
  const sliced = (sliceStart !== 0 || sliceEnd !== undefined) ? line.slice(sliceStart, sliceEnd) : line;

  const tryNormalizeDomain = normalizeDomain(sliced);
  if (tryNormalizeDomain === sliced) {
    // the entire rule is domain
    result[0] = sliced;
    result[1] = ParseType.BlackIncludeSubdomain;

    return result;
  }

  result[0] = `[parse-filter ${tryNormalizeDomain === null ? 'E0010' : 'E0011'}] can not parse: ${JSON.stringify({ line, tryNormalizeDomain, sliced })}`;
  result[1] = ParseType.ErrorMessage;
  return result;
}
