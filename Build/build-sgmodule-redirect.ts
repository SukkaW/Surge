import path from 'path';
import { task } from './trace';
import { compareAndWriteFile } from './lib/create-file';
import * as tldts from 'tldts';

function escapeRegExp(string = '') {
  const reRegExpChar = /[$()*+.?[\\\]^{|}]/g;
  const reHasRegExpChar = new RegExp(reRegExpChar.source);

  return string && reHasRegExpChar.test(string)
    ? string.replaceAll(reRegExpChar, '\\$&')
    : string;
}

const REDIRECT = [
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
  // cravatar
  ['cravatar.cn/', 'https://secure.gravatar.com/'],
  // libravatar
  ['seccdn.libravatar.org/gravatarproxy/', 'https://secure.gravatar.com/'],
  // ghproxy
  ['ghproxy.com/', 'https://'],
  ['ghps.cc/', 'https://'],
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
  ['assets.fastgit.org/', 'https://github.githubassets.com/'],
  // jsDelivr
  ['fastly.jsdelivr.net/', 'https://cdn.jsdelivr.net/'],
  ['gcore.jsdelivr.net/', 'https://cdn.jsdelivr.net/'],
  // ops.ci
  ['jsdelivr.ops.ci/', 'https://cdn.jsdelivr.net/'],
  ['fonts.ops.ci/', 'https://fonts.googleapis.com/'],
  // onmicrosoft.cn
  ['jsd.onmicrosoft.cn/', 'https://cdn.jsdelivr.net/'],
  ['npm.onmicrosoft.cn/', 'https://unpkg.com/'],
  ['cdnjs.onmicrosoft.cn/', 'https://cdnjs.cloudflare.com/ajax/libs/'],
  // KGitHub
  ['raw.kgithub.com/', 'https://raw.githubusercontent.com/'],
  ['raw.kkgithub.com/', 'https://raw.githubusercontent.com/'],
  // Polyfill
  ['polyfill.io/', 'https://cdnjs.cloudflare.com/polyfill/'],
  ['fastly-polyfill.io/', 'https://cdnjs.cloudflare.com/polyfill/'],
  ['fastly-polyfill.net/', 'https://cdnjs.cloudflare.com/polyfill/'],
  // Misc
  ['pics.javbus.com/', 'https://i0.wp.com/pics.javbus.com/'],
  ['googlefonts.wp-china-yes.net/', 'https://fonts.googleapis.com/'],
  ['googleajax.wp-china-yes.net/', 'https://ajax.googleapis.com/']
] as const;

export const buildRedirectModule = task(import.meta.path, async (span) => {
  const domains = Array.from(new Set(REDIRECT.map(([from]) => tldts.getHostname(from, { detectIp: false })))).filter(Boolean);

  return compareAndWriteFile(
    span,
    [
      '#!name=[Sukka] URL Redirect',
      `#!desc=Last Updated: ${new Date().toISOString()}`,
      '',
      '[MITM]',
      `hostname = %APPEND% ${domains.join(', ')}`,
      '',
      '[URL Rewrite]',
      ...REDIRECT.map(([from, to]) => `^https?://${escapeRegExp(from)}(.*) ${to}$1 302`)
    ],
    path.resolve(import.meta.dir, '../Modules/sukka_url_redirect.sgmodule')
  );
});

if (import.meta.main) {
  buildRedirectModule();
}
