const fs = require('fs');
const { promises: fsPromises } = fs;
const pathFn = require('path');
const table = require('table');

const PRESET_MITM_HOSTNAMES = [
  '*baidu.com',
  '*ydstatic.com',
  '*snssdk.com',
  '*musical.com',
  '*musical.ly',
  '*snssdk.ly',
  'api.chelaile.net.cn',
  'atrace.chelaile.net.cn',
  '*.meituan.net',
  'ctrl.playcvn.com',
  'ctrl.playcvn.net',
  'ctrl.zmzapi.com',
  'ctrl.zmzapi.net',
  'api.zhuishushenqi.com',
  'b.zhuishushenqi.com',
  '*.music.126.net',
  '*.prod.hosts.ooklaserver.net'
];

(async () => {
  const folderListPath = pathFn.resolve(__dirname, '../List/');
  const rulesets = await listDir(folderListPath);
  let urlRegexPaths = [];

  urlRegexPaths.push(
    ...(await fsPromises.readFile(pathFn.join(__dirname, '../Modules/sukka_url_rewrite.sgmodule'), { encoding: 'utf-8' }))
      .split('\n')
      .filter(
        i => !i.startsWith('#')
          && !i.startsWith('[')
      )
      .map(i => i.split(' ')[0])
      .map(i => ({
        origin: i,
        processed: i
          .replaceAll('(www.)?', '{www or not}')
          .replaceAll('^https?://', '')
          .replaceAll('^https://', '')
          .replaceAll('^http://', '')
          .split('/')[0]
          .replaceAll('\\.', '.')
          .replaceAll('.+', '*')
          .replaceAll('(.*)', '*')
      }))
  );

  const bothWwwApexDomains = [];
  urlRegexPaths = urlRegexPaths.map(i => {
    if (!i.processed.includes('{www or not}')) return i;

    const d = i.processed.replace('{www or not}', '');
    bothWwwApexDomains.push({
      origin: i.origin,
      processed: `www.${d}`
    });

    return {
      origin: i.origin,
      processed: d
    };
  });

  urlRegexPaths.push(...bothWwwApexDomains);

  await Promise.all(rulesets.map(async file => {
    const content = (await fsPromises.readFile(pathFn.join(folderListPath, file), { encoding: 'utf-8' })).split('\n');
    urlRegexPaths.push(
      ...content
        .filter(i => i.startsWith('URL-REGEX'))
        .map(i => i.split(',')[1])
        .map(i => ({
          origin: i,
          processed: i
            .replaceAll('^https?://', '')
            .replaceAll('^https://', '')
            .replaceAll('^http://', '')
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

  let mitmDomains = new Set(PRESET_MITM_HOSTNAMES); // Special case for parsed failed
  const parsedFailures = new Set();

  const dedupedUrlRegexPaths = [...new Set(urlRegexPaths)];

  dedupedUrlRegexPaths.forEach(i => {
    const result = parseDomain(i.processed);

    if (result.success) {
      mitmDomains.add(result.hostname.trim());
    } else {
      parsedFailures.add(i.origin);
    }
  });

  mitmDomains = [...mitmDomains].filter(i => {
    return i.length > 3
      && !i.includes('.mp4') // Special Case
      && i !== '(www.)' // Special Case
      && !(i !== '*baidu.com' && i.endsWith('baidu.com')) // Special Case
      && !(i !== '*.meituan.net' && i.endsWith('.meituan.net'))
      && !i.startsWith('.')
      && !i.endsWith('.')
      && !i.endsWith('*')
  });

  const mitmDomainsRegExpArray = mitmDomains.map(i => {
    return new RegExp(
      escapeRegExp(i)
        .replaceAll('{www or not}', '(www.)?')
        .replaceAll('\\*', '(.*)')
    )
  });

  const parsedDomainsData = [];
  dedupedUrlRegexPaths.forEach(i => {
    const result = parseDomain(i.processed);

    if (result.success) {
      if (matchWithRegExpArray(result.hostname.trim(), mitmDomainsRegExpArray)) {
        parsedDomainsData.push([green(result.hostname), i.origin]);
      } else {
        parsedDomainsData.push([yellow(result.hostname), i.origin]);
      }
    }
  });

  console.log('Mitm Hostnames:');
  console.log('hostname = %APPEND% ' + mitmDomains.join(', '));
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
function green(...args) {
  return `\u001b[32m${args.join(' ')}\u001b[0m`;
}
function yellow(...args) {
  return `\u001b[33m${args.join(' ')}\u001b[0m`;
}

function parseDomain(input) {
  try {
    const url = new URL(`https://${input}`);
    return {
      success: true,
      hostname: url.hostname
    }
  } catch {
    return {
      success: false
    }
  }
}

function matchWithRegExpArray(input, regexps = []) {
  for (const r of regexps) {
    if (r.test(input)) return true;
  }

  return false;
}

function escapeRegExp(string = '') {
  const reRegExpChar = /[\\^$.*+?()[\]{}|]/g;
  const reHasRegExpChar = RegExp(reRegExpChar.source);

  return string && reHasRegExpChar.test(string)
    ? string.replace(reRegExpChar, '\\$&')
    : string;
}

function listDir(path, options) {
  const results = [];
  options = Object.assign({ ignoreHidden: true, ignorePattern: null }, options);
  return listDirWalker(path, results, '', options).then(() => results);
}
function listDirWalker(path, results, parent, options) {
  const promises = [];
  return readAndFilterDir(path, options).then(items => {
    items.forEach(item => {
      const currentPath = pathFn.join(parent, item.name);
      if (item.isDirectory()) {
        promises.push(listDirWalker(pathFn.join(path, item.name), results, currentPath, options));
      }
      else {
        results.push(currentPath);
      }
    });
  }).then(() => Promise.all(promises));
}
function readAndFilterDir(path, options) {
  const { ignoreHidden = true, ignorePattern } = options;
  return fs.promises.readdir(path, Object.assign(Object.assign({}, options), { withFileTypes: true }))
    .then(results => {
      if (ignoreHidden) {
        results = results.filter(({ name }) => !name.startsWith('.'));
      }
      if (ignorePattern) {
        results = results.filter(({ name }) => !ignorePattern.test(name));
      }
      return results;
    });
}

