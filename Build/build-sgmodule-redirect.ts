import path from 'node:path';
import { task } from './trace';
import { compareAndWriteFile } from './lib/create-file';
import { getHostname } from 'tldts-experimental';
import { isTruthy } from 'foxts/guard';
import { OUTPUT_MODULES_DIR } from './constants/dir';

function escapeRegExp(string = '') {
  const reRegExpChar = /[$()*+.?[\\\]^{|}]/g;
  const reHasRegExpChar = new RegExp(reRegExpChar.source);

  return string && reHasRegExpChar.test(string)
    ? string.replaceAll(reRegExpChar, String.raw`\$&`)
    : string;
}

const REDIRECT_MIRROR_HEADER = [
  // Gravatar
  ['gravatar.neworld.org/', 'https://secure.gravatar.com/'],
  ['cdn.v2ex.com/gravatar/', 'https://secure.gravatar.com/avatar/'],
  // U.SB
  ['cdnjs.loli.net/', 'https://cdnjs.cloudflare.com/'],
  ['fonts.loli.net/', 'https://fonts.googleapis.com/'],
  ['gstatic.loli.net/', 'https://fonts.gstatic.com/'],
  ['themes.loli.net/', 'https://themes.googleusercontent.com/'],
  ['ajax.loli.net/', 'https://ajax.googleapis.com/'],
  ['gravatar.loli.net/', 'https://secure.gravatar.com/'],
  // Geekzu
  ['gapis.geekzu.org/ajax/', 'https://ajax.googleapis.com/'],
  ['fonts.geekzu.org/', 'https://fonts.googleapis.com/'],
  ['gapis.geekzu.org/g-fonts/', 'https://fonts.gstatic.com/'],
  ['gapis.geekzu.org/g-themes/', 'https://themes.googleusercontent.com/'],
  ['sdn.geekzu.org/', 'https://secure.gravatar.com/'],
  // libravatar
  ['seccdn.libravatar.org/gravatarproxy/', 'https://secure.gravatar.com/'],
  // gh-proxy
  ['github.moeyy.xyz/', 'https://'],
  // 7ED Services
  ['use.sevencdn.com/css', 'https://fonts.googleapis.com/css'],
  ['use.sevencdn.com/ajax/libs/', 'https://cdnjs.cloudflare.com/ajax/libs/'],
  ['use.sevencdn.com/gajax/', 'https://ajax.googleapis.com/ajax/'],
  ['use.sevencdn.com/chart', 'https://chart.googleapis.com/chart'],
  ['use.sevencdn.com/avatar', 'https://secure.gravatar.com/avatar'],
  ['raw.gitmirror.com/', 'https://raw.githubusercontent.com/'],
  ['gist.gitmirror.com/', 'https://gist.githubusercontent.com/'],
  ['raw.githubusercontents.com/', 'https://raw.githubusercontent.com/'],
  ['gist.githubusercontents.com/', 'https://gist.githubusercontent.com/'],
  ['cdn.gitmirror.com/', 'https://cdn.statically.io/'],
  // FastGit
  ['raw.fastgit.org/', 'https://raw.githubusercontent.com/'],
  // ['assets.fastgit.org/', 'https://github.githubassets.com/'],
  // jsDelivr
  ['fastly.jsdelivr.net/', 'https://cdn.jsdelivr.net/'],
  ['gcore.jsdelivr.net/', 'https://cdn.jsdelivr.net/'],
  ['testingcf.jsdelivr.net/', 'https://cdn.jsdelivr.net/'],
  // JSDMirror
  ['cdn.jsdmirror.com/', 'https://cdn.jsdelivr.net/'],
  ['cdn.jsdmirror.cn/', 'https://cdn.jsdelivr.net/'],
  // onmicrosoft.cn
  ['jsd.onmicrosoft.cn/', 'https://cdn.jsdelivr.net/'],
  ['npm.onmicrosoft.cn/', 'https://cdn.jsdelivr.net/npm/'],
  ['cdnjs.onmicrosoft.cn/', 'https://cdnjs.cloudflare.com/ajax/libs/'],
  // KGitHub
  ['raw.kgithub.com/', 'https://raw.githubusercontent.com/'],
  ['raw.kkgithub.com/', 'https://raw.githubusercontent.com/'],
  // cdn.iocdn.cc
  ['cdn.iocdn.cc/avatar/', 'https://secure.gravatar.com/avatar/'],
  ['cdn.iocdn.cc/css', 'https://fonts.googleapis.com/css'],
  ['cdn.iocdn.cc/icon', 'https://fonts.googleapis.com/icon'],
  ['cdn.iocdn.cc/earlyaccess', 'https://fonts.googleapis.com/earlyaccess'],
  ['cdn.iocdn.cc/s', 'fonts.gstatic.com/s'],
  ['cdn.iocdn.cc/static', 'themes.googleusercontent.com/static'],
  ['cdn.iocdn.cc/ajax', 'ajax.googleapis.com/ajax'],
  ['cdn.iocdn.cc/', 'https://cdn.jsdelivr.net/'],
  // wp-china-yes
  ['googlefonts.admincdn.com/', 'https://fonts.googleapis.com/'],
  ['googleajax.admincdn.com/', 'https://ajax.googleapis.com/'],
  ['cdnjs.admincdn.com/', 'https://cdnjs.cloudflare.com/ajax/libs/'],
  // Polyfill
  ['polyfill.io/', 'https://cdnjs.cloudflare.com/polyfill/'],
  ['polyfill.top/', 'https://cdnjs.cloudflare.com/polyfill/'],
  ['polyfill-js.cn/', 'https://cdnjs.cloudflare.com/polyfill/'],
  ['cdn.polyfill.io/', 'https://cdnjs.cloudflare.com/polyfill/'],
  ['fastly-polyfill.io/', 'https://cdnjs.cloudflare.com/polyfill/'],
  ['fastly-polyfill.net/', 'https://cdnjs.cloudflare.com/polyfill/'],
  ['polyfill-fastly.net/', 'https://cdnjs.cloudflare.com/polyfill/'],
  // BootCDN has been controlled by a malicious actor and being used to spread malware
  ['cdn.bootcss.com/', 'https://cdnjs.cloudflare.com/ajax/libs/'],
  ['cdn.bootcdn.net/', 'https://cdnjs.cloudflare.com/ajax/libs/'],
  ['cdn.staticfile.net/', 'https://cdnjs.cloudflare.com/ajax/libs/'],
  ['cdn.staticfile.org/', 'https://cdnjs.cloudflare.com/ajax/libs/'],
  // The UNPKG has not been actively maintained and is finally down (https://github.com/unpkg/unpkg/issues/412)
  ['unpkg.com/', 'https://cdn.jsdelivr.net/npm/'],
  // Misc
  ['pics.javbus.com/', 'https://i0.wp.com/pics.javbus.com/']
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
  ['missav.com/', 'https://missav.ai/'],
  ['missav.ws/', 'https://missav.ai/'],
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
  const domains = Array.from(new Set([
    ...REDIRECT_MIRROR_HEADER.map(([from]) => getHostname(from, { detectIp: false })),
    ...REDIRECT_FAKEWEBSITES.flatMap(([from]) => [from, `*.${from}`]),
    ...REDIRECT_MIRROR_307.map(([from]) => getHostname(from, { detectIp: false }))
  ])).filter(isTruthy);

  return compareAndWriteFile(
    span,
    [
      '#!name=[Sukka] URL Redirect',
      `#!desc=Last Updated: ${new Date().toISOString()} Size: ${domains.length}`,
      '',
      '[MITM]',
      `hostname = %APPEND% ${domains.join(', ')}`,
      '',
      '[URL Rewrite]',
      ...REDIRECT_MIRROR_HEADER.map(([from, to]) => `^https?://${escapeRegExp(from)}(.*) ${to}$1 header`),
      ...REDIRECT_FAKEWEBSITES.map(([from, to]) => `^https?://(www.)?${escapeRegExp(from)} ${to} 307`),
      ...REDIRECT_MIRROR_307.map(([from, to]) => `^https?://${escapeRegExp(from)}(.*) ${to}$1 307`)
    ],
    path.join(OUTPUT_MODULES_DIR, 'sukka_url_redirect.sgmodule')
  );
});
