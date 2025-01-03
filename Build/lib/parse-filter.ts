import { NetworkFilter } from '@ghostery/adblocker';
import { processLine } from './process-line';
import tldts from 'tldts-experimental';

import picocolors from 'picocolors';
import { normalizeDomain } from './normalize-domain';
import { deserializeArray, fsFetchCache, serializeArray, getFileContentHash } from './cache-filesystem';
import type { Span } from '../trace';
import { createRetrieKeywordFilter as createKeywordFilter } from 'foxts/retrie';
import { looseTldtsOpt } from '../constants/loose-tldts-opt';
import { identity } from 'foxts/identity';
import { DEBUG_DOMAIN_TO_FIND } from '../constants/reject-data-source';
import { noop } from 'foxts/noop';

let foundDebugDomain = false;
const temporaryBypass = typeof DEBUG_DOMAIN_TO_FIND === 'string';

const onBlackFound = DEBUG_DOMAIN_TO_FIND
  ? (line: string, meta: string) => {
    if (line.includes(DEBUG_DOMAIN_TO_FIND!)) {
      console.warn(picocolors.red(meta), '(black)', line.replaceAll(DEBUG_DOMAIN_TO_FIND!, picocolors.bold(DEBUG_DOMAIN_TO_FIND)));
      foundDebugDomain = true;
    }
  }
  : noop;

const onWhiteFound = DEBUG_DOMAIN_TO_FIND
  ? (line: string, meta: string) => {
    if (line.includes(DEBUG_DOMAIN_TO_FIND!)) {
      console.warn(picocolors.red(meta), '(white)', line.replaceAll(DEBUG_DOMAIN_TO_FIND!, picocolors.bold(DEBUG_DOMAIN_TO_FIND)));
      foundDebugDomain = true;
    }
  }
  : noop;

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

  onBlackFound(domain, meta);

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

  onBlackFound(domain, meta);

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

        if (flag === ParseType.WhiteIncludeSubdomain || flag === ParseType.WhiteAbsolute) {
          onWhiteFound(hostname, filterRulesUrl);
        } else {
          onBlackFound(hostname, filterRulesUrl);
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

  const line = $line.trim();

  if (line.length === 0) {
    result[1] = ParseType.Null;
    return result;
  }

  const firstCharCode = line.charCodeAt(0);
  const lastCharCode = line.charCodeAt(line.length - 1);

  if (
    firstCharCode === 47 // 47 `/`
    // ends with
    // _160-600.
    // -detect-adblock.
    // _web-advert.
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

  /**
   * From now on, we are mostly facing non-standard domain rules (some are regex like)
   *
   * We can still salvage some of them by removing modifiers
   */

  let sliceStart = 0;
  let sliceEnd = 0;

  // After NetworkFilter.parse, it means the line can not be parsed by cliqz NetworkFilter
  // We now need to "salvage" the line as much as possible

  let white = false;
  let includeAllSubDomain = false;

  if (
    firstCharCode === 64 // 64 `@`
    && line.charCodeAt(1) === 64 // 64 `@`
  ) {
    sliceStart += 2;
    white = true;
    includeAllSubDomain = true;
  }

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

  switch (line.charCodeAt(sliceStart)) {
    case 124: /** | */
      // line.startsWith('@@|') || line.startsWith('|')
      sliceStart += 1;
      includeAllSubDomain = false;

      if (line[sliceStart] === '|') { // line.startsWith('@@||') || line.startsWith('||')
        sliceStart += 1;
        includeAllSubDomain = true;
      }

      break;

    case 46: { /** | */ // line.startsWith('@@.') || line.startsWith('.')
      /**
       * `.ay.delivery^`
       * `.m.bookben.com^`
       * `.wap.x4399.com^`
       */
      sliceStart += 1;
      includeAllSubDomain = true;
      break;
    }

    default:
      break;
  }

  switch (line.charCodeAt(sliceStart)) {
    case 58: { /** : */
      /**
       * `@@://googleadservices.com^|`
       * `@@://www.googleadservices.com^|`
       * `://mine.torrent.pw^`
       * `://say.ac^`
       */
      if (line[sliceStart + 1] === '/' && line[sliceStart + 2] === '/') {
        includeAllSubDomain = false;
        sliceStart += 3;
      }
      break;
    }

    case 104: { /** h */
      /** |http://x.o2.pl^ */
      if (line.startsWith('http://', sliceStart)) {
        includeAllSubDomain = false;
        sliceStart += 7;
      } else if (line.startsWith('https://', sliceStart)) {
        includeAllSubDomain = false;
        sliceStart += 8;
      }
      break;
    }

    default:
      break;
  }

  const indexOfDollar = line.indexOf('$', sliceStart);
  if (indexOfDollar > -1) {
    sliceEnd = indexOfDollar - line.length;
  }

  /*
   * We skip third-party and frame rules, as Surge / Clash can't handle them
   *
   * `.sharecounter.$third-party`
   * `.bbelements.com^$third-party`
   * `://o0e.ru^$third-party`
   * `.1.1.1.l80.js^$third-party`
   */
  if (
    !allowThirdParty
    && (
      line.includes('third-party', indexOfDollar + 1)
      || line.includes('3p', indexOfDollar + 1)
    )
  ) {
    result[1] = ParseType.Null;
    return result;
  }

  if (line.includes('badfilter', indexOfDollar + 1)) {
    white = true;
  }
  if (line.includes('all', indexOfDollar + 1)) {
    includeAllSubDomain = true;
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
  if (line.charCodeAt(line.length + sliceEnd - 1) === 94) { // 94 `^`
    /** line.endsWith('^') */
    sliceEnd -= 1;
  } else if (line.charCodeAt(line.length + sliceEnd - 1) === 124) { // 124 `|`
    /** line.endsWith('|') */
    sliceEnd -= 1;

    if (line.charCodeAt(line.length + sliceEnd - 1) === 94) { // 94 `^`
      /** line.endsWith('^|') */
      sliceEnd -= 1;
    }
  } else if (line.charCodeAt(line.length + sliceEnd - 1) === 46) { // 46 `.`
    /** line.endsWith('.') */
    sliceEnd -= 1;
  }

  const sliced = (sliceStart > 0 || sliceEnd < 0) ? line.slice(sliceStart, sliceEnd === 0 ? undefined : sliceEnd) : line;
  if (sliced.charCodeAt(0) === 45 /* - */) {
    // line.startsWith('-') is not a valid domain
    result[1] = ParseType.ErrorMessage;
    result[0] = `[parse-filter E0001] (${white ? 'white' : 'black'}) invalid domain: ${JSON.stringify({
      line, sliced, sliceStart, sliceEnd
    })}`;
    return result;
  }

  const suffix = tldts.getPublicSuffix(sliced, looseTldtsOpt);
  if (!suffix) {
    // This exclude domain-like resource like `_social_tracking.js^`
    result[1] = ParseType.Null;
    return result;
  }

  const domain = normalizeDomain(sliced);

  if (domain && domain === sliced) {
    result[0] = domain;

    if (white) {
      result[1] = includeAllSubDomain ? ParseType.WhiteIncludeSubdomain : ParseType.WhiteAbsolute;
    } else {
      result[1] = includeAllSubDomain ? ParseType.BlackIncludeSubdomain : ParseType.BlackAbsolute;
    }
    return result;
  }

  result[0] = `[parse-filter E0010] (${white ? 'white' : 'black'}) invalid domain: ${JSON.stringify({
    line, domain, suffix, sliced, sliceStart, sliceEnd
  })}`;
  result[1] = ParseType.ErrorMessage;
  return result;
}
