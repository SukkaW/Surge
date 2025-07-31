import picocolors from 'picocolors';
import type { Span } from '../../trace';
import { fetchAssets } from '../fetch-assets';
import { onBlackFound, onWhiteFound } from './shared';
import { createRetrieKeywordFilter as createKeywordFilter } from 'foxts/retrie';
import { looseTldtsOpt } from '../../constants/loose-tldts-opt';
import tldts from 'tldts';
import { NetworkFilter } from '@ghostery/adblocker';
import { isProbablyIpv4, isProbablyIpv6 } from 'foxts/is-probably-ip';

const enum ParseType {
  WhiteIncludeSubdomain = 0,
  WhiteAbsolute = -1,
  BlackAbsolute = 1,
  BlackIncludeSubdomain = 2,
  ErrorMessage = 10,
  BlackIP = 20,
  BlackWildcard = 30,
  BlackKeyword = 40,
  WhiteKeyword = 50,
  Null = 1000,
  NotParsed = 2000
}

export { type ParseType };

export function processFilterRulesWithPreload(
  filterRulesUrl: string,
  fallbackUrls?: string[] | null,
  includeThirdParty = false
) {
  const downloadPromise = fetchAssets(
    filterRulesUrl, fallbackUrls,
    true, false, true
  );

  return (span: Span) => span.traceChildAsync<
    Record<
      'whiteDomains'
      | 'whiteDomainSuffixes'
      | 'blackDomains'
      | 'blackDomainSuffixes'
      | 'blackIPs'
      | 'blackWildcard'
      | 'whiteKeyword'
      | 'blackKeyword',
      string[]
    > & {
      filterRulesUrl: string
    }
  >(`process filter rules: ${filterRulesUrl}`, async (span) => {
    const filterRules = await span.traceChildPromise('download', downloadPromise);

    const whiteDomains = new Set<string>();
    const whiteDomainSuffixes = new Set<string>();

    const blackDomains = new Set<string>();
    const blackDomainSuffixes = new Set<string>();

    const warningMessages: string[] = [];

    const blackIPs: string[] = [];
    const blackWildcard = new Set<string>();

    const whiteKeyword = new Set<string>();
    const blackKeyword = new Set<string>();

    const MUTABLE_PARSE_LINE_RESULT: [string, ParseType] = ['', ParseType.NotParsed];
    /**
       * @param {string} line
       */
    const lineCb = (line: string) => {
      const result = parse(line, MUTABLE_PARSE_LINE_RESULT, includeThirdParty);
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
          whiteDomainSuffixes.add(hostname);
          break;
        case ParseType.WhiteAbsolute:
          whiteDomains.add(hostname);
          break;
        case ParseType.BlackIncludeSubdomain:
          blackDomainSuffixes.add(hostname);
          break;
        case ParseType.BlackAbsolute:
          blackDomains.add(hostname);
          break;
        case ParseType.ErrorMessage:
          warningMessages.push(hostname);
          break;
        case ParseType.BlackIP:
          blackIPs.push(hostname);
          break;
        case ParseType.BlackWildcard:
          blackWildcard.add(hostname);
          break;
        case ParseType.BlackKeyword:
          blackKeyword.add(hostname);
          break;
        case ParseType.WhiteKeyword:
          whiteKeyword.add(hostname);
          break;
        default:
          break;
      }
    };

    span.traceChild('parse adguard filter').traceSyncFn(() => {
      for (let i = 0, len = filterRules.length; i < len; i++) {
        lineCb(filterRules[i]);
      }
    });

    for (let i = 0, len = warningMessages.length; i < len; i++) {
      console.warn(
        picocolors.yellow(warningMessages[i]),
        picocolors.gray(picocolors.underline(filterRulesUrl))
      );
    }

    console.log(
      picocolors.gray('[process filter]'),
      picocolors.gray(filterRulesUrl),
      picocolors.gray(`white: ${whiteDomains.size + whiteDomainSuffixes.size}`),
      picocolors.gray(`black: ${blackDomains.size + blackDomainSuffixes.size}`)
    );

    return {
      filterRulesUrl,
      whiteDomains: Array.from(whiteDomains),
      whiteDomainSuffixes: Array.from(whiteDomainSuffixes),
      blackDomains: Array.from(blackDomains),
      blackDomainSuffixes: Array.from(blackDomainSuffixes),
      blackIPs,
      blackWildcard: Array.from(blackWildcard),
      whiteKeyword: Array.from(whiteKeyword),
      blackKeyword: Array.from(blackKeyword)
    };
  });
}

// many filter that has modifiers can not work on Surge/Clash because browser context is required
// we can early bail out those rules
const kwfilter = createKeywordFilter([
  '!',
  '?',
  // '*', // *://example.com/*
  '[',
  '(',
  ']',
  ')',
  ',', // $3p,doc
  '#',
  '%',
  '&',
  // '=', // maybe we want to support some modifier?
  '~',
  // special modifier
  '$popup',
  '$denlyallow',
  '$removeparam',
  '$uritransform',
  '$urlskip',
  '$replace',
  '$redirect',
  '$popunder',
  '$cname',
  '$frame',
  '$domain',
  '$from',
  '$to',
  '$csp',
  '$replace',
  '$urlskip',
  '$elemhide',
  '$generichide',
  '$genericblock',
  '$header',
  '$permissions',
  '$ping',
  // some bad syntax
  '^popup'
]);

/**
 * The idea is that, TransformStream works kinda like a filter running on response. If we
 * can filter lines before Array.fromAsync, we can create a smaller array, this saves memory
 * and could improve performance.
 */
export class AdGuardFilterIgnoreUnsupportedLinesStream extends TransformStream<string, string> {
  // private __buf = '';
  constructor() {
    super({
      transform(line, controller) {
        let firstCharCode = line.charCodeAt(0);
        if (
          // bail out path-like/cosmetic very early, even before trim
          firstCharCode === 47 // /
          || firstCharCode === 35 // #
          // doesn't include
          || !line.includes('.') // rule with out dot can not be a domain
          || kwfilter(line) // filter out some symbols/modifiers
        ) {
          return;
        }

        line = line.trim();

        if (line.length === 0) {
          return;
        }

        firstCharCode = line.charCodeAt(0);
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
        ) {
          return;
        }

        if ((line.includes('/') || line.includes(':')) && !line.includes('://')) {
          return;
        }

        controller.enqueue(line);
      }
    });
  }
}

export function parse(line: string, result: [string, ParseType], includeThirdParty: boolean): [hostname: string, flag: ParseType] {
  // We have already done this in AdGuardFilterIgnoreUnsupportedLinesStream

  // if (
  //   // doesn't include
  //   !$line.includes('.') // rule with out dot can not be a domain
  //   // includes
  //   || kwfilter($line)
  //   // note that this can only excludes $redirect but not $3p,redirect, so we still need to parse it
  //   // this is only an early bail out
  // ) {
  //   result[1] = ParseType.Null;
  //   return result;
  // }

  // const line = $line.trim();

  // if (line.length === 0) {
  //   result[1] = ParseType.Null;
  //   return result;
  // }

  // const firstCharCode = line.charCodeAt(0);
  // const lastCharCode = line.charCodeAt(line.length - 1);

  // if (
  //   firstCharCode === 47 // 47 `/`
  //   // ends with
  //   // _160-600.
  //   // -detect-adblock.
  //   // _web-advert.
  //   || lastCharCode === 46 // 46 `.`, line.endsWith('.')
  //   || lastCharCode === 45 // 45 `-`, line.endsWith('-')
  //   || lastCharCode === 95 // 95 `_`, line.endsWith('_')
  // ) {
  //   result[1] = ParseType.Null;
  //   return result;
  // }

  // if ((line.includes('/') || line.includes(':')) && !line.includes('://')) {
  //   return;
  // }

  const filter = NetworkFilter.parse(line, false);
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
      filter.hostname !== undefined // filter.hasHostname() // must have
      && filter.isPlain() // isPlain() === !isRegex()
      // ghostry run some strict checks again invalid syntax and marked them as regex as well
      // https://github.com/ghostery/adblocker/blob/bfffdce89e741e7aa010de3759b4b536b7c23430/packages/adblocker/src/filters/network.ts#L1103
      // So instead we manually salvage them instead of relying on them
      // && (!filter.isRegex())
      // && (!filter.isFullRegex()) // pattern starts and ends with "/", we can't parse this
    ) {
      const _1p = filter.firstParty();
      const _3p = filter.thirdParty();
      const white = filter.isException() || filter.isBadFilter();

      if (white) {
        return onHostname(
          filter.hostname,
          white,
          //  |: filter.isHostnameAnchor(),
          //  |: filter.isLeftAnchor(),
          //  |https://: !filter.isHostnameAnchor() && (filter.fromHttps() || filter.fromHttp())
          filter.isHostnameAnchor(),
          line,
          result
        );
      }

      if (_3p) {
        if (_1p || includeThirdParty) { // both first party and third party are true
          // only then we run onHostname
          return onHostname(
            filter.hostname,
            white,
            //  |: filter.isHostnameAnchor(),
            //  |: filter.isLeftAnchor(),
            //  |https://: !filter.isHostnameAnchor() && (filter.fromHttps() || filter.fromHttp())
            filter.isHostnameAnchor(),
            line,
            result
          );
        }

        // only third party is true and w/o first party, there is no need to run onHostname anyway
        result[1] = ParseType.Null;
        return result;
      }

      // third party is already false
      if (_1p) { // first part only
        return onHostname(
          filter.hostname,
          white,
          //  |: filter.isHostnameAnchor(),
          //  |: filter.isLeftAnchor(),
          //  |https://: !filter.isHostnameAnchor() && (filter.fromHttps() || filter.fromHttp())
          filter.isHostnameAnchor(),
          line,
          result
        );
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

  // After NetworkFilter.parse, it means the line can not be parsed by ghostry NetworkFilter
  // We now need to "salvage" the line as much as possible

  let white = false;
  let includeAllSubDomain = false;

  if (
    line.charCodeAt(0) === 64 // 64 `@`
    && line.charCodeAt(1) === 64 // 64 `@`
  ) {
    sliceStart += 2;
    white = true;
    includeAllSubDomain = true;
  }

  /**
   * Some "malformed" regex-based filters can not be parsed by NetworkFilter
   *
   * `@@|ftp.bmp.ovh^|`
   * `@@|adsterra.com^|`
   * `@@.atlassian.net$document`
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

    case 46: { /** . */ // line.startsWith('@@.') || line.startsWith('.')
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
    !includeThirdParty
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
  if (sliced.length === 0 || sliced.includes('/')) {
    result[1] = ParseType.Null;
    return result;
  }

  return onHostname(sliced, white, includeAllSubDomain, line, result);
}

function onHostname(
  input: string,
  white: boolean,
  isIncludeAllSubDomain: boolean,
  rawLine: string,
  result: [string, ParseType]
) {
  // We don't want tldts to call its own "extractHostname" on ip, bail out ip first.
  if (isProbablyIpv4(input) || isProbablyIpv6(input)) {
    if (white) {
      // We do not support whitelist IP anyway.
      result[0] = `[parse-filter E0022] (white) no whitelist ip support: ${JSON.stringify({
        input, rawLine
      })}`;
      result[1] = ParseType.ErrorMessage;
      return result;
    }
    result[0] = input;
    result[1] = ParseType.BlackIP;
    return result;
  }
  // Now ip has been bailed out, we can safely set normalizeTldtsOpt.detectIp to false.

  const parsed = tldts.parse(input, looseTldtsOpt);

  /**
   * We can exclude wildcard in TLD
   *
   * ||example.*
   *
   * We can also exclude URL path pattern like this, since TLD and file extension don't overlapped
   *
   * -ad.css
   * -ad.js
   *
   * This also exclude non standard TLD like `.tor`, `.onion`, `.dn42`, etc.
   */
  if (!parsed.publicSuffix || !parsed.isIcann || !parsed.hostname || !parsed.domain) {
    result[1] = ParseType.Null;
    return result;
  }

  let hostname = parsed.hostname;

  // no wildcard, we can safely normalize it
  if (!hostname.includes('*')) {
    if (hostname.charCodeAt(0) === 45) { // 45 `-`
      result[0] = hostname;
      result[1] = white ? ParseType.WhiteKeyword : ParseType.BlackKeyword;
      return result;
    }

    if (white) {
      result[0] = hostname;
      result[1] = isIncludeAllSubDomain ? ParseType.WhiteIncludeSubdomain : ParseType.WhiteAbsolute;
      return result;
    }

    // we only strip www when it is blacklist
    if (parsed.subdomain) {
      if (
        parsed.subdomain === 'www'
        || parsed.subdomain === 'xml-v4'
        || parsed.subdomain === 'xml-eu'
        || parsed.subdomain === 'xml-eu-v4'
      ) {
        hostname = parsed.domain;
      } else if (parsed.subdomain.startsWith('www.')) {
        hostname = parsed.subdomain.slice(4) + '.' + parsed.domain;
      }
    }

    result[0] = hostname;
    result[1] = isIncludeAllSubDomain ? ParseType.BlackIncludeSubdomain : ParseType.BlackAbsolute;
    return result;
  }

  // now we only have wildcard domain left
  if (white) {
    // we don't support wildcard in whitelist
    // result[1] = ParseType.Null;
    // return result;
    result[0] = `[parse-filter E0021] wildcard whitelist not supported: ${JSON.stringify({
      input, rawLine, parsed
    })}`;
    result[1] = ParseType.ErrorMessage;
    return result;
  }

  for (let i = 0, len = hostname.length; i < len; i++) {
    const char = hostname.charCodeAt(i);

    if (
      (char >= 97 && char <= 122) // 97-122 `a-z`
      || char === 46 // 46 `.`
      || char === 45 // 45 `-`
      || (char >= 48 && char <= 57) // 48-57 `0-9`
      || char === 42 // 42 `*`
      || char === 95 // 95 `_`
      // || (char >= 65 && char <= 90) // 65-90 `A-Z`
    ) {
      continue;
    }

    result[0] = `[parse-filter E0020] (black) invalid wildcard domain: ${JSON.stringify({
      input, rawLine, parsed
    })}`;
    result[1] = ParseType.ErrorMessage;
    return result;
  }

  if (hostname.charCodeAt(0) === 45) { // 45 `-`
    // starts with - and also containing * wildcard
    hostname = '*' + hostname;
  }

  result[0] = hostname;
  result[1] = ParseType.BlackWildcard;
  return result;
}
