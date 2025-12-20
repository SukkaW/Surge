import path from 'node:path';
import { task } from './trace';
import { compareAndWriteFile } from './lib/create-file';
import { getHostname } from 'tldts-experimental';
import { OUTPUT_INTERNAL_DIR, OUTPUT_MODULES_DIR } from './constants/dir';
import { escapeRegexp } from 'fast-escape-regexp';

const REDIRECT_MIRROR_HEADER = [
  // Gravatar
  // ['gravatar.neworld.org/', 'https://secure.gravatar.com/'],
  ['cdn.v2ex.com/gravatar/', 'https://secure.gravatar.com/avatar/', true],
  // U.SB
  ['cdnjs.loli.net/', 'https://cdnjs.cloudflare.com/', true],
  ['fonts.loli.net/', 'https://fonts.googleapis.com/', true],
  ['gstatic.loli.net/', 'https://fonts.gstatic.com/', true],
  ['themes.loli.net/', 'https://themes.googleusercontent.com/', true],
  ['ajax.loli.net/', 'https://ajax.googleapis.com/', true],
  ['gravatar.loli.net/', 'https://secure.gravatar.com/', true],
  // Geekzu
  ['gapis.geekzu.org/ajax/', 'https://ajax.googleapis.com/', true],
  ['fonts.geekzu.org/', 'https://fonts.googleapis.com/', true],
  ['gapis.geekzu.org/g-fonts/', 'https://fonts.gstatic.com/', true],
  ['gapis.geekzu.org/g-themes/', 'https://themes.googleusercontent.com/', true],
  ['sdn.geekzu.org/', 'https://secure.gravatar.com/', true],
  // libravatar
  ['seccdn.libravatar.org/gravatarproxy/', 'https://secure.gravatar.com/', true],
  // 7ED Services
  ['use.sevencdn.com/css', 'https://fonts.googleapis.com/css', true],
  ['use.sevencdn.com/ajax/libs/', 'https://cdnjs.cloudflare.com/ajax/libs/', true],
  ['use.sevencdn.com/gajax/', 'https://ajax.googleapis.com/ajax/', true],
  ['use.sevencdn.com/chart', 'https://chart.googleapis.com/chart', true],
  ['use.sevencdn.com/avatar', 'https://secure.gravatar.com/avatar', true],
  ['raw.gitmirror.com/', 'https://raw.githubusercontent.com/'],
  ['gist.gitmirror.com/', 'https://gist.githubusercontent.com/'],
  ['raw.githubusercontents.com/', 'https://raw.githubusercontent.com/'],
  ['gist.githubusercontents.com/', 'https://gist.githubusercontent.com/'],
  ['cdn.gitmirror.com/', 'https://cdn.statically.io/'],
  // FastGit
  ['raw.fastgit.org/', 'https://raw.githubusercontent.com/'],
  // ['assets.fastgit.org/', 'https://github.githubassets.com/'],
  // jsDelivr
  ['fastly.jsdelivr.net/', 'https://cdn.jsdelivr.net/', true],
  ['gcore.jsdelivr.net/', 'https://cdn.jsdelivr.net/', true],
  ['testingcf.jsdelivr.net/', 'https://cdn.jsdelivr.net/', true],
  // JSDMirror
  ['cdn.jsdmirror.com/', 'https://cdn.jsdelivr.net/', true],
  ['cdn.jsdmirror.cn/', 'https://cdn.jsdelivr.net/', true],
  // onmicrosoft.cn
  ['jsd.onmicrosoft.cn/', 'https://cdn.jsdelivr.net/', true],
  ['npm.onmicrosoft.cn/', 'https://cdn.jsdelivr.net/npm/', true],
  ['cdnjs.onmicrosoft.cn/', 'https://cdnjs.cloudflare.com/ajax/libs/', true],
  // KGitHub
  ['raw.kgithub.com/', 'https://raw.githubusercontent.com/'],
  ['raw.kkgithub.com/', 'https://raw.githubusercontent.com/'],
  // cdn.iocdn.cc
  ['cdn.iocdn.cc/avatar/', 'https://secure.gravatar.com/avatar/', true],
  ['cdn.iocdn.cc/css', 'https://fonts.googleapis.com/css', true],
  ['cdn.iocdn.cc/icon', 'https://fonts.googleapis.com/icon', true],
  ['cdn.iocdn.cc/earlyaccess', 'https://fonts.googleapis.com/earlyaccess', true],
  ['cdn.iocdn.cc/s', 'https://fonts.gstatic.com/s', true],
  ['cdn.iocdn.cc/static', 'https://themes.googleusercontent.com/static', true],
  ['cdn.iocdn.cc/ajax', 'https://ajax.googleapis.com/ajax', true],
  ['cdn.iocdn.cc/', 'https://cdn.jsdelivr.net/', true],
  // wp-china-yes
  ['googlefonts.admincdn.com/', 'https://fonts.googleapis.com/', true],
  ['googleajax.admincdn.com/', 'https://ajax.googleapis.com/', true],
  ['cdnjs.admincdn.com/', 'https://cdnjs.cloudflare.com/ajax/libs/', true],
  // Polyfill
  ['polyfill.io/', 'https://cdnjs.cloudflare.com/polyfill/', true],
  ['polyfill.top/', 'https://cdnjs.cloudflare.com/polyfill/', true],
  ['polyfill-js.cn/', 'https://cdnjs.cloudflare.com/polyfill/', true],
  ['cdn.polyfill.io/', 'https://cdnjs.cloudflare.com/polyfill/', true],
  ['fastly-polyfill.io/', 'https://cdnjs.cloudflare.com/polyfill/', true],
  ['fastly-polyfill.net/', 'https://cdnjs.cloudflare.com/polyfill/', true],
  ['polyfill-fastly.net/', 'https://cdnjs.cloudflare.com/polyfill/', true],
  // BootCDN has been controlled by a malicious actor and being used to spread malware
  ['cdn.bootcss.com/', 'https://cdnjs.cloudflare.com/ajax/libs/'],
  ['cdn.bootcdn.net/', 'https://cdnjs.cloudflare.com/ajax/libs/'],
  ['cdn.staticfile.net/', 'https://cdnjs.cloudflare.com/ajax/libs/'],
  ['cdn.staticfile.org/', 'https://cdnjs.cloudflare.com/ajax/libs/'],
  // The UNPKG has not been actively maintained and is finally down (https://github.com/unpkg/unpkg/issues/412)
  ['unpkg.com/', 'https://cdn.jsdelivr.net/npm/', true]
] as const;

const REDIRECT_MIRROR_307 = [
  // Redirect Google
  ['google.cn/', 'https://google.com/'],
  ['www.google.cn/', 'https://www.google.com/'],
  ['g.cn/', 'https://google.com/'],
  ['ditu.google.cn/', 'https://maps.google.com/'],
  ['maps.google.cn/', 'https://maps.google.com/'],
  ['www.g.cn/', 'https://www.google.com/'],
  // avg.tv/sm114514 -> https://www.nicovideo.jp/watch/sm114514
  ['acg.tv/sm', 'https://www.nicovideo.jp/watch/sm'],
  ['acg.tv/', 'https://b23.tv/'],
  // Minecraft Wiki
  ['minecraft.fandom.com/wiki/', 'https://minecraft.wiki/w/'],
  ['minecraft.fandom.com/', 'https://minecraft.wiki/'],
  // Hello, FANZA!
  ['missav.com/', 'https://missav.ai/'],
  ['thisav.com/', 'https://thisav.me/']
];

const REDIRECT_FAKEWEBSITES = [
  // IGN China to IGN Global
  ['ign.xn--fiqs8s', 'https://cn.ign.com/ccpref/us'],
  // Fuck Makeding
  ['abbyychina.com', 'https://www.abbyy.cn'],
  ['bartender.cc', 'https://www.seagullscientific.com'],
  ['betterzip.net', 'https://macitbetter.com'],
  ['beyondcompare.cc', 'https://www.scootersoftware.com'],
  ['bingdianhuanyuan.cn', 'https://www.faronics.com'],
  ['chemdraw.com.cn', 'https://revvitysignals.com/products/research/chemdraw'],
  ['codesoftchina.com', 'https://www.teklynx.com'],
  ['coreldrawchina.com', 'https://www.coreldraw.com'],
  ['crossoverchina.com', 'https://www.codeweavers.com'],
  ['easyrecoverychina.com', 'https://www.ontrack.com'],
  ['ediuschina.com', 'https://www.grassvalley.com'],
  ['flstudiochina.com', 'https://www.image-line.com/fl-studio'],
  ['formysql.com', 'https://www.navicat.com.cn'],
  ['guitarpro.cc', 'https://www.guitar-pro.com'],
  ['huishenghuiying.com.cn', 'https://www.corel.com'],
  ['iconworkshop.cn', 'https://www.axialis.com/iconworkshop'],
  ['imindmap.cc', 'https://imindmap.com/zh-cn'],
  ['jihehuaban.com.cn', 'https://sketch.io'],
  ['keyshot.cc', 'https://www.keyshot.com'],
  ['mathtype.cn', 'https://www.wiris.com/en/mathtype'],
  ['mindmanager.cc', 'https://www.mindjet.com'],
  ['mindmapper.cc', 'https://mindmapper.com'],
  ['mycleanmymac.com', 'https://macpaw.com/cleanmymac'],
  ['nicelabel.cc', 'https://www.nicelabel.com'],
  ['ntfsformac.cc', 'https://www.tuxera.com/products/tuxera-ntfs-for-mac-cn'],
  ['ntfsformac.cn', 'https://www.paragon-software.com/ufsdhome/zh/ntfs-mac'],
  ['overturechina.com', 'https://sonicscores.com/overture'],
  ['passwordrecovery.cn', 'https://cn.elcomsoft.com/aopr.html'],
  ['pdfexpert.cc', 'https://pdfexpert.com/zh'],
  ['ultraiso.net', 'https://cn.ezbsystems.com/ultraiso'],
  ['vegaschina.cn', 'https://www.vegas.com'],
  ['xmindchina.net', 'https://www.xmind.cn'],
  ['xshellcn.com', 'https://www.netsarang.com/products/xsh_overview.html'],
  ['yuanchengxiezuo.com', 'https://www.teamviewer.com/zhcn'],
  ['zbrushcn.com', 'https://www.maxon.net/en/zbrush']
] as const;

export const buildRedirectModule = task(require.main === module, __filename)(async (span) => {
  const fullDomains: string[] = [];
  const minimumDomains: string[] = [];

  for (let i = 0, len = REDIRECT_MIRROR_HEADER.length; i < len; i++) {
    const [from, , canUboUriTransform] = REDIRECT_MIRROR_HEADER[i];
    const hostname = getHostname(from, { detectIp: false });
    if (hostname) {
      fullDomains.push(hostname);
      if (!canUboUriTransform) {
        minimumDomains.push(hostname);
      }
    }
  }
  for (let i = 0, len = REDIRECT_MIRROR_307.length; i < len; i++) {
    const [from] = REDIRECT_MIRROR_307[i];
    const hostname = getHostname(from, { detectIp: false });
    if (hostname) {
      fullDomains.push(hostname);
      minimumDomains.push(hostname);
    }
  }
  for (let i = 0, len = REDIRECT_FAKEWEBSITES.length; i < len; i++) {
    const [from] = REDIRECT_FAKEWEBSITES[i];
    const hostname = getHostname(from, { detectIp: false });
    if (hostname) {
      fullDomains.push(hostname);
      minimumDomains.push(hostname);
    }
  }

  await Promise.all([
    compareAndWriteFile(
      span,
      [
        '#!name=[Sukka] URL Redirect',
        `#!desc=Last Updated: ${new Date().toISOString()} Size: ${fullDomains.length}`,
        '',
        '[MITM]',
        `hostname = %APPEND% ${fullDomains.join(', ')}`,
        '',
        '[URL Rewrite]',
        ...REDIRECT_MIRROR_HEADER.map(([from, to]) => `^https?://${escapeRegexp(from)}(.*) ${to}$1 header`),
        ...REDIRECT_FAKEWEBSITES.map(([from, to]) => `^https?://(www.)?${(from)} ${to} 307`),
        ...REDIRECT_MIRROR_307.map(([from, to]) => `^https?://${escapeRegexp(from)}(.*) ${to}$1 307`)
      ],
      path.join(OUTPUT_MODULES_DIR, 'sukka_url_redirect.sgmodule')
    ),
    compareAndWriteFile(
      span,
      [
        '#!name=[Sukka] URL Redirect (Minimum)',
        `#!desc=Last Updated: ${new Date().toISOString()} Size: ${minimumDomains.length}`,
        '# This module only contains rules that doesn\'t work with/hasn\'t migrated to uBlock Origin\'s "uritransform" filter syntax',
        '# uBO/AdGuard filter can be found at https://ruleset.skk.moe/Internal/sukka_ubo_url_redirect_filters.txt',
        '',
        '[MITM]',
        `hostname = %APPEND% ${minimumDomains.join(', ')}`,
        '',
        '[URL Rewrite]',
        ...REDIRECT_MIRROR_HEADER.reduce<string[]>((acc, [from, to, canUboUriTransform]) => {
          if (!canUboUriTransform) {
            acc.push(`^https?://${escapeRegexp(from)}(.*) ${to}$1 header`);
          }
          return acc;
        }, []),
        ...REDIRECT_FAKEWEBSITES.map(([from, to]) => `^https?://(www.)?${(from)} ${to} 307`),
        ...REDIRECT_MIRROR_307.map(([from, to]) => `^https?://${escapeRegexp(from)}(.*) ${to}$1 307`)
      ],
      path.join(OUTPUT_MODULES_DIR, 'sukka_url_redirect_minimum.sgmodule')
    ),
    compareAndWriteFile(
      span,
      [
        '! Title: [sukka] Sukka URL Redirect',
        `! Last modified: ${new Date().toUTCString()}`,
        '! Expires: 4 hours',
        '! Description: Redirect requests via uritransform network filter syntax.',
        '! License: https://ruleset.skk.moe/LICENSE',
        '! Homepage: https://ruleset.skk.moe',
        '! GitHub: https://github.com/SukkaW/Surge',
        '',
        ...REDIRECT_MIRROR_HEADER.reduce<string[]>((acc, [from, to, canUboUriTransform]) => {
          if (!canUboUriTransform) {
            return acc;
          }

          acc.push(
            '||'
            + from
            + '$all,uritransform=/'
            + escapeRegexp(from).replaceAll('/', String.raw`\/`)
            + '/'
            + to.replace('https://', '').replaceAll('/', String.raw`\/`)
            + '/'
          );

          return acc;
        }, [])
      ],
      path.join(OUTPUT_INTERNAL_DIR, 'sukka_ubo_url_redirect_filters.txt')
    )
  ]);
});
