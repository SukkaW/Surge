import path from 'node:path';
import fs from 'node:fs';
import fsp from 'node:fs/promises';

import { task } from './trace';
import { treeDir } from './lib/tree-dir';
import type { TreeType, TreeTypeArray } from './lib/tree-dir';

import { OUTPUT_MOCK_DIR, OUTPUT_MODULES_DIR, PUBLIC_DIR, ROOT_DIR } from './constants/dir';
import { writeFile } from './lib/misc';
import picocolors from 'picocolors';

const mockDir = path.join(ROOT_DIR, 'Mock');
const modulesDir = path.join(ROOT_DIR, 'Modules');

const copyDirContents = async (srcDir: string, destDir: string) => {
  const promises: Array<Promise<void>> = [];

  for await (const entry of await fsp.opendir(srcDir)) {
    const src = path.join(srcDir, entry.name);
    const dest = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      console.warn(picocolors.red('[build public] cant copy directory'), src);
    } else {
      promises.push(fsp.copyFile(src, dest, fs.constants.COPYFILE_FICLONE));
    }
  }

  return Promise.all(promises);
};

export const buildPublic = task(require.main === module, __filename)(async (span) => {
  await span.traceChildAsync('copy rest of the files', async () => {
    await Promise.all([
      fsp.mkdir(OUTPUT_MODULES_DIR, { recursive: true }),
      fsp.mkdir(OUTPUT_MOCK_DIR, { recursive: true })
    ]);

    await Promise.all([
      copyDirContents(modulesDir, OUTPUT_MODULES_DIR),
      copyDirContents(mockDir, OUTPUT_MOCK_DIR)
    ]);
  });

  const html = await span
    .traceChild('generate index.html')
    .traceAsyncFn(() => treeDir(PUBLIC_DIR).then(generateHtml));

  return writeFile(path.join(PUBLIC_DIR, 'index.html'), html);
});

const priorityOrder: Record<'default' | string & {}, number> = {
  domainset: 1,
  non_ip: 2,
  ip: 3,
  List: 10,
  Surge: 11,
  Clash: 12,
  'sing-box': 13,
  Modules: 20,
  Script: 30,
  Mock: 40,
  Assets: 50,
  Internal: 60,
  LICENSE: 70,
  default: Number.MAX_VALUE
};
const prioritySorter = (a: TreeType, b: TreeType) => {
  return ((priorityOrder[a.name] || priorityOrder.default) - (priorityOrder[b.name] || priorityOrder.default)) || a.name.localeCompare(b.name);
};

const html = (string: TemplateStringsArray, ...values: any[]) => string.reduce((acc, str, i) => acc + str + (values[i] ?? ''), '');

const walk = (tree: TreeTypeArray) => {
  let result = '';
  tree.sort(prioritySorter);
  for (let i = 0, len = tree.length; i < len; i++) {
    const entry = tree[i];
    if (entry.type === 'directory') {
      result += html`
        <li class="folder">
          ${entry.name}
          <ul>
            ${walk(entry.children)}
          </ul>
        </li>
      `;
    } else if (/* entry.type === 'file' && */ entry.name !== 'index.html') {
      result += html`<li><a class="file directory-list-file" href="${entry.path}">${entry.name}</a></li>`;
    }
  }
  return result;
};

function generateHtml(tree: TreeTypeArray) {
  return html`
      <!DOCTYPE html>
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
        </head>
      <body>
        <main class="container">
          <h1>Sukka Ruleset Server</h1>
          <p>
            Made by <a href="https://skk.moe">Sukka</a> | <a href="https://github.com/SukkaW/Surge/">Source @ GitHub</a> | Licensed under <a href="/LICENSE" target="_blank">AGPL-3.0</a>
          </p>
          <p>Last Build: ${new Date().toISOString()}</p>
          <br>
          <ul class="directory-list">
            ${walk(tree)}
          </ul>
        </main>
      </body>
    </html>
  `;
}
