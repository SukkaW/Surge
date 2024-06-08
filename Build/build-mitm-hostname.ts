import { readFileByLine } from './lib/fetch-text-by-line';
import pathFn from 'path';
import table from 'table';
import { fdir as Fdir } from 'fdir';
import { green, yellow } from 'picocolors';
import { processLineFromReadline } from './lib/process-line';
import { getHostname } from 'tldts';

const PRESET_MITM_HOSTNAMES = [
  // '*baidu.com',
  '*.ydstatic.com',
  // '*snssdk.com',
  // '*musical.com',
  // '*musical.ly',
  // '*snssdk.ly',
  'api.zhihu.com',
  'www.zhihu.com',
  'api.chelaile.net.cn',
  'atrace.chelaile.net.cn',
  '*.meituan.net',
  'ctrl.playcvn.com',
  'ctrl.playcvn.net',
  'ctrl.zmzapi.com',
  'ctrl.zmzapi.net',
  'api.zhuishushenqi.com',
  'b.zhuishushenqi.com',
  'ggic.cmvideo.cn',
  'ggic2.cmvideo.cn',
  'mrobot.pcauto.com.cn',
  'mrobot.pconline.com.cn',
  'home.umetrip.com',
  'discardrp.umetrip.com',
  'startup.umetrip.com',
  'dsp-x.jd.com',
  'bdsp-x.jd.com'
];

(async () => {
  const folderListPath = pathFn.resolve(__dirname, '../List/');

  const rulesets = await new Fdir()
    .withFullPaths()
    .crawl(folderListPath)
    .withPromise();

  const urlRegexPaths: Array<{ origin: string, processed: string }> = [];

  await Promise.all(rulesets.map(async file => {
    const content = await processLineFromReadline(readFileByLine(file));
    urlRegexPaths.push(
      ...content
        .filter(i => (
          i.startsWith('URL-REGEX')
          && !i.includes('http://')
        ))
        .map(i => i.split(',')[1])
        .map(i => ({
          origin: i,
          processed: i
            .replaceAll('^https?://', '')
            .replaceAll('^https://', '')
            .replaceAll('^http://', '')
            .split('/')[0]
            .replaceAll('\\.', '.')
            .replaceAll('.+', '*')
            .replaceAll('\\d', '*')
            .replaceAll('([a-z])', '*')
            .replaceAll('[a-z]', '*')
            .replaceAll('([0-9])', '*')
            .replaceAll('[0-9]', '*')
            .replaceAll(/{.+?}/g, '')
            .replaceAll(/\*+/g, '*')
        }))
    );
  }));

  const mitmDomains = new Set(PRESET_MITM_HOSTNAMES); // Special case for parsed failed
  const parsedFailures = new Set();

  const dedupedUrlRegexPaths = [...new Set(urlRegexPaths)];

  dedupedUrlRegexPaths.forEach(i => {
    const result = getHostnameSafe(i.processed);

    if (result) {
      mitmDomains.add(result);
    } else {
      parsedFailures.add(`${i.origin} ${i.processed} ${result}`);
    }
  });

  const mitmDomainsRegExpArray = Array.from(mitmDomains)
    .slice()
    .filter(i => {
      return i.length > 3
        && !i.includes('.mp4') // Special Case
        && i !== '(www.)' // Special Case
        && !(i !== '*.meituan.net' && i.endsWith('.meituan.net'))
        && !i.startsWith('.')
        && !i.endsWith('.')
        && !i.endsWith('*');
    })
    .map(i => {
      return new RegExp(
        escapeRegExp(i)
          .replaceAll('{www or not}', '(www.)?')
          .replaceAll('\\*', '(.*)')
      );
    });

  const parsedDomainsData: Array<[string, string]> = [];
  dedupedUrlRegexPaths.forEach(i => {
    const result = getHostnameSafe(i.processed);

    if (result) {
      if (matchWithRegExpArray(result, mitmDomainsRegExpArray)) {
        parsedDomainsData.push([green(result), i.origin]);
      } else {
        parsedDomainsData.push([yellow(result), i.origin]);
      }
    }
  });

  console.log('Mitm Hostnames:');
  console.log(`hostname = %APPEND% ${Array.from(mitmDomains).join(', ')}`);
  console.log('--------------------');
  console.log('Parsed Sucessed:');
  console.log(table.table(parsedDomainsData, {
    border: table.getBorderCharacters('void'),
    columnDefault: {
      paddingLeft: 0,
      paddingRight: 3
    },
    drawHorizontalLine: () => false
  }));
  console.log('--------------------');
  console.log('Parsed Failed');
  console.log([...parsedFailures].join('\n'));
})();

/** Util function */

function getHostnameSafe(input: string) {
  const res = getHostname(input);
  if (res && /[^\s\w*.-]/.test(res)) return null;
  return res;
}

function matchWithRegExpArray(input: string, regexps: RegExp[] = []) {
  for (const r of regexps) {
    if (r.test(input)) return true;
  }

  return false;
}

function escapeRegExp(string = '') {
  const reRegExpChar = /[$()*+.?[\\\]^{|}]/g;
  const reHasRegExpChar = new RegExp(reRegExpChar.source);

  return string && reHasRegExpChar.test(string)
    ? string.replaceAll(reRegExpChar, '\\$&')
    : string;
}
