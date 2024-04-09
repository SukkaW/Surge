import path from 'path';
import { task } from './trace';
import { treeDir } from './lib/tree-dir';
import type { TreeType, TreeTypeArray } from './lib/tree-dir';
import listDir from '@sukka/listdir';

const rootPath = path.resolve(import.meta.dir, '../');
const publicPath = path.resolve(import.meta.dir, '../public');

const folderAndFilesToBeDeployed = [
  `Mock${path.sep}`,
  `List${path.sep}`,
  `Clash${path.sep}`,
  `Modules${path.sep}`,
  `Script${path.sep}`,
  `Internal${path.sep}`,
  'LICENSE'
];

export const buildPublic = task(import.meta.path, async (span) => {
  await span
    .traceChild('copy public files')
    .traceAsyncFn(async () => {
      const filesToBeCopied = (await listDir(
        rootPath, {
          ignoreHidden: true,
          ignorePattern: /node_modules|Build|public/
        }
      )).filter(file => folderAndFilesToBeDeployed.some(folderOrFile => file.startsWith(folderOrFile)));

      return Promise.all(filesToBeCopied.map(file => {
        const src = path.resolve(rootPath, file);
        const dest = path.resolve(publicPath, file);

        return Bun.write(dest, Bun.file(src));
      }));
    });

  const html = await span
    .traceChild('generate index.html')
    .traceAsyncFn(() => treeDir(publicPath).then(generateHtml));

  return Bun.write(path.join(publicPath, 'index.html'), html);
});

if (import.meta.main) {
  buildPublic();
}

const priorityOrder: Record<'default' | string & {}, number> = {
  domainset: 1,
  non_ip: 2,
  ip: 3,
  List: 10,
  Surge: 11,
  Clash: 12,
  Modules: 13,
  Script: 14,
  Mock: 15,
  Assets: 16,
  Internal: 17,
  LICENSE: 20,
  default: Number.MAX_VALUE
};
const prioritySorter = (a: TreeType, b: TreeType) => {
  return ((priorityOrder[a.name] || priorityOrder.default) - (priorityOrder[b.name] || priorityOrder.default)) || a.name.localeCompare(b.name);
};
const walk = (tree: TreeTypeArray) => {
  let result = '';
  tree.sort(prioritySorter);
  for (let i = 0, len = tree.length; i < len; i++) {
    const entry = tree[i];
    if (entry.type === 'directory') {
      result += `<li class="folder">${entry.name}`;
      result += '<ul>';
      result += walk(entry.children);
      result += '</ul>';
    } else if (/* entry.type === 'file' && */ entry.name !== 'index.html') {
      result += `<li><a class="file directory-list-file" href="${entry.path}">${entry.name}</a></li>`;
    }
  }
  return result;
};

function generateHtml(tree: TreeTypeArray) {
  let html = `<!DOCTYPE html>
  <html lang="en">

  <head>
    <meta charset="utf-8">
    <title>Surge Ruleset Server | Sukka (@SukkaW)</title>
    <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
    <link href="https://cdn.skk.moe/favicon.ico" rel="icon" type="image/ico">
    <link href="https://cdn.skk.moe/favicon/apple-touch-icon.png" rel="apple-touch-icon" sizes="180x180">
    <link href="https://cdn.skk.moe/favicon/android-chrome-192x192.png" rel="icon" type="image/png" sizes="192x192">
    <link href="https://cdn.skk.moe/favicon/favicon-32x32.png" rel="icon" type="image/png" sizes="32x32">
    <link href="https://cdn.skk.moe/favicon/favicon-16x16.png" rel="icon" type="image/png" sizes="16x16">
    <meta name="description" content="Sukka 自用的 Surge / Clash Premium 规则组">
  
    <link rel="stylesheet" href="https://cdn.skk.moe/ruleset/css/21d8777a.css" />
  
    <meta property="og:title" content="Surge Ruleset | Sukka (@SukkaW)">
    <meta property="og:type" content="Website">
    <meta property="og:url" content="https://ruleset.skk.moe/">
    <meta property="og:image" content="https://cdn.skk.moe/favicon/android-chrome-192x192.png">
    <meta property="og:description" content="Sukka 自用的 Surge / Clash Premium 规则组">
    <meta name="twitter:card" content="summary">
    <link rel="canonical" href="https://ruleset.skk.moe/">
  </head>`;

  html += `<body>
  <main class="container">
    <h1>Sukka Ruleset Server</h1>
    <p>
      Made by <a href="https://skk.moe">Sukka</a> | <a href="https://github.com/SukkaW/Surge/">Source @ GitHub</a> | Licensed under <a href="/LICENSE" target="_blank">AGPL-3.0</a>
    </p>
    <p>Last Build: ${new Date().toISOString()}</p>
    <br>`;

  html += '<ul class="directory-list">';

  html += walk(tree);

  html += '</ul>';

  html += `</main>
  </body>
  </html>`;

  return html;
}
