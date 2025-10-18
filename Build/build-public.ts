import path from 'node:path';
import fs from 'node:fs';
import fsp from 'node:fs/promises';

import { task } from './trace';
import { treeDir, TreeFileType } from './lib/tree-dir';
import type { TreeType, TreeTypeArray } from './lib/tree-dir';

import { OUTPUT_MOCK_DIR, OUTPUT_MODULES_DIR, PUBLIC_DIR, ROOT_DIR } from './constants/dir';
import { writeFile } from './lib/misc';
import { fastStringCompare } from 'foxts/fast-string-compare';
import type { VoidOrVoidArray } from './lib/misc';
import picocolors from 'picocolors';
import { tagged as html } from 'foxts/tagged';
import { compareAndWriteFile } from './lib/create-file';
import { appendArrayInPlace } from 'foxts/append-array-in-place';

const priorityOrder: Record<'default' | string & {}, number> = {
  LICENSE: 0,
  domainset: 10,
  non_ip: 20,
  ip: 30,
  List: 40,
  Surge: 50,
  Clash: 60,
  'sing-box': 70,
  Surfboard: 80,
  LegacyClashPremium: 81,
  Modules: 90,
  Script: 100,
  Mock: 110,
  Assets: 120,
  Internal: 130,
  default: Number.MAX_VALUE
};

const closedRootFolders = [
  'Mock',
  'Internal'
];

async function copyDirContents(srcDir: string, destDir: string, promises: Array<Promise<VoidOrVoidArray>> = []): Promise<Array<Promise<VoidOrVoidArray>>> {
  for await (const entry of await fsp.opendir(srcDir)) {
    const src = path.join(srcDir, entry.name);
    const dest = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      console.warn(picocolors.red('[build public] cant copy directory'), src);
    } else {
      promises.push(fsp.copyFile(src, dest, fs.constants.COPYFILE_FICLONE));
    }
  }

  return promises;
}

export const buildPublic = task(require.main === module, __filename)(async (span) => {
  await span.traceChildAsync('copy rest of the files', async () => {
    const p: Array<Promise<any>> = [];

    fs.mkdirSync(OUTPUT_MODULES_DIR, { recursive: true });
    p.push(copyDirContents(path.join(ROOT_DIR, 'Modules'), OUTPUT_MODULES_DIR, p));

    fs.mkdirSync(OUTPUT_MOCK_DIR, { recursive: true });
    p.push(copyDirContents(path.join(ROOT_DIR, 'Mock'), OUTPUT_MOCK_DIR, p));

    await Promise.all(p);
  });

  const html = await span
    .traceChild('generate index.html')
    .traceAsyncFn(() => treeDir(PUBLIC_DIR).then(generateHtml));

  await Promise.all([
    compareAndWriteFile(
      span,
      appendArrayInPlace(
        [
          '/*',
          '  cache-control: public, max-age=300, stale-while-revalidate=30, stale-if-error=60',
          'https://:project.pages.dev/*',
          '  X-Robots-Tag: noindex'
        ],
        Object.keys(priorityOrder).map((name) => `/${name}/*\n  content-type: text/plain; charset=utf-8\n  X-Robots-Tag: noindex`)
      ),
      path.join(PUBLIC_DIR, '_headers')
    ),
    compareAndWriteFile(
      span,
      [
        '# <pre>',
        '#########################################',
        '# Sukka\'s Ruleset - 404 Not Found',
        '################## EOF ##################</pre>'
      ],
      path.join(PUBLIC_DIR, '404.html')
    ),
    compareAndWriteFile(
      span,
      [
        '# This is a Robot-managed repo containing only output',
        '# The source code is located at [Sukkaw/Surge](https://github.com/Sukkaw/Surge)',
        '# Please follow the development at the source code repo instead',
        '',
        '![GitHub repo size](https://img.shields.io/github/repo-size/sukkalab/ruleset.skk.moe?style=flat-square)'
      ],
      path.join(PUBLIC_DIR, 'README.md')
    )
  ]);

  return writeFile(path.join(PUBLIC_DIR, 'index.html'), html);
});

const prioritySorter = (a: TreeType, b: TreeType) => ((priorityOrder[a.name] || priorityOrder.default) - (priorityOrder[b.name] || priorityOrder.default)) || fastStringCompare(a.name, b.name);

function treeHtml(tree: TreeTypeArray, level = 0, closedFolderList: string[] = []): string {
  let result = '';
  tree.sort(prioritySorter);

  for (let i = 0, len = tree.length; i < len; i++) {
    const entry = tree[i];
    const open = closedFolderList.includes(entry.name) ? '' : (level === 0 ? 'open' : '');

    if (entry.type === TreeFileType.DIRECTORY) {
      result += html`
        <li class="folder">
          <details ${open}>
            <summary>${entry.name}</summary>
            <ul>${treeHtml(entry.children, level + 1)}</ul>
          </details>
        </li>
      `;
    } else if (/* entry.type === 'file' && */ !entry.name.endsWith('.html') && !entry.name.startsWith('_')) {
      result += html`
        <li class="file"><a class="file-link" href="${entry.path}">${entry.name}</a></li>
      `;
    }
  }
  return result;
}

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

        <meta property="og:title" content="Surge Ruleset | Sukka (@SukkaW)">
        <meta property="og:type" content="Website">
        <meta property="og:url" content="https://ruleset.skk.moe/">
        <meta property="og:image" content="https://cdn.skk.moe/favicon/android-chrome-192x192.png">
        <meta property="og:description" content="Sukka 自用的 Surge / Clash Premium 规则组">
        <meta name="twitter:card" content="summary">
        <link rel="canonical" href="https://ruleset.skk.moe/">
        <style>
          :root {
            --font-family: system-ui, -apple-system, "Segoe UI", "Roboto", "Ubuntu", "Cantarell", "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
            --line-height: 1.5;
            --font-weight: 400;
            --font-size: 16px;
            --border-radius: 0.25rem;
            --border-width: 1px;
            --outline-width: 3px;
            --spacing: 1rem;
            --typography-spacing-vertical: 1.5rem;
            --block-spacing-vertical: calc(var(--spacing)*2);
            --block-spacing-horizontal: var(--spacing);
            --nav-element-spacing-vertical: 1rem;
            --nav-element-spacing-horizontal: 0.5rem;
            --nav-link-spacing-vertical: 0.5rem;
            --nav-link-spacing-horizontal: 0.5rem;
            --form-label-font-weight: var(--font-weight);
            --transition: 0.2s ease-in-out
          }

          @media (min-width:576px) {
            :root {
              --font-size: 17px
            }
          }

          @media (min-width:768px) {
            :root {
              --font-size: 18px
            }
          }

          @media (min-width:992px) {
            :root {
              --font-size: 19px
            }
          }

          @media (min-width:1200px) {
            :root {
              --font-size: 20px
            }
          }

        a {
          --text-decoration: none
        }

        a.contrast,
        a.secondary {
          --text-decoration: underline
        }

        small {
          --font-size: 0.875em
        }

      h1,
      h2,
      h3,
      h4,
      h5,
      h6 {
        --font-weight: 700
      }

      h1 {
        --font-size: 2rem;
        --typography-spacing-vertical: 3rem
      }

      :not(thead):not(tfoot)>*>td {
        --font-size: 0.875em
      }

      code,
      kbd,
      pre,
      samp {
        --font-family: "Menlo", "Consolas", "Roboto Mono", "Ubuntu Monospace", "Noto Mono", "Oxygen Mono", "Liberation Mono", monospace, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"
      }

      kbd {
        --font-weight: bolder
      }

      :root:not([data-theme=dark]),
      [data-theme=light] {
        --background-color: #fff;
        --color: #415462;
        --h1-color: #1b2832;
        --h2-color: #24333e;
        --h3-color: #2c3d49;
        --h4-color: #374956;
        --h5-color: #415462;
        --h6-color: #4d606d;
        --muted-color: #73828c;
        --muted-border-color: #edf0f3;
        --primary: #1095c1;
        --primary-hover: #08769b;
        --primary-focus: rgba(16, 149, 193, .125);
        --primary-inverse: #fff;
        --secondary: #596b78;
        --secondary-hover: #415462;
        --secondary-focus: rgba(89, 107, 120, .125);
        --secondary-inverse: #fff;
        --contrast: #1b2832;
        --contrast-hover: #000;
        --contrast-focus: rgba(89, 107, 120, .125);
        --contrast-inverse: #fff;
        --mark-background-color: #fff2ca;
        --mark-color: #543a26;
        --modal-overlay-background-color: rgba(213, 220, 226, .8);
        --loading-spinner-opacity: 0.5;
        --icon-folder: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' stroke='%23415462' stroke-width='1.5' viewBox='0 0 24 24'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.06-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.38a1.5 1.5 0 0 1-1.06-.44Z'/%3E%3C/svg%3E");
        --icon-file: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' stroke='%23415462' stroke-width='1.5' viewBox='0 0 24 24'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19.5 14.25v-2.63a3.38 3.38 0 0 0-3.38-3.37h-1.5a1.13 1.13 0 0 1-1.12-1.13v-1.5a3.38 3.38 0 0 0-3.38-3.37H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.62c-.62 0-1.12.5-1.12 1.13v17.25c0 .62.5 1.12 1.13 1.12h12.75c.62 0 1.12-.5 1.12-1.13v-9.37a9 9 0 0 0-9-9Z'/%3E%3C/svg%3E");
        --icon-folder-open: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' stroke='%23415462' stroke-width='1.5' viewBox='0 0 24 24'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M3.75 9.78c.11-.02.23-.03.34-.03h15.82c.11 0 .23 0 .34.03m-16.5 0a2.25 2.25 0 0 0-1.88 2.54l.85 6a2.25 2.25 0 0 0 2.23 1.93h14.1a2.25 2.25 0 0 0 2.23-1.93l.85-6a2.25 2.25 0 0 0-1.88-2.54m-16.5 0V6A2.25 2.25 0 0 1 6 3.75h3.88a1.5 1.5 0 0 1 1.06.44l2.12 2.12a1.5 1.5 0 0 0 1.06.44H18A2.25 2.25 0 0 1 20.25 9v.78'/%3E%3C/svg%3E");
        color-scheme: light
      }

      @media only screen and (prefers-color-scheme:dark) {
        :root:not([data-theme=light]) {
          --background-color: #11191f;
          --color: #bbc6ce;
          --h1-color: #edf0f3;
          --h2-color: #e1e6eb;
          --h3-color: #d5dce2;
          --h4-color: #c8d1d8;
          --h5-color: #bbc6ce;
          --h6-color: #afbbc4;
          --muted-color: #73828c;
          --muted-border-color: #1f2d38;
          --primary: #1095c1;
          --primary-hover: #1ab3e6;
          --primary-focus: rgba(16, 149, 193, .25);
          --primary-inverse: #fff;
          --secondary: #596b78;
          --secondary-hover: #73828c;
          --secondary-focus: rgba(115, 130, 140, .25);
          --secondary-inverse: #fff;
          --contrast: #edf0f3;
          --contrast-hover: #fff;
          --contrast-focus: rgba(115, 130, 140, .25);
          --contrast-inverse: #000;
          --mark-background-color: #d1c284;
          --mark-color: #11191f;
          --modal-overlay-background-color: rgba(36, 51, 62, .9);
          --loading-spinner-opacity: 0.5;
          --icon-folder: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' fill='none' stroke='%23bbc6ce' stroke-linecap='round' stroke-linejoin='round' stroke-width='2'%3E%3Cpath d='M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z'/%3E%3C/svg%3E");
          --icon-file: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' stroke='%23bbc6ce' stroke-width='1.5' viewBox='0 0 24 24'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19.5 14.25v-2.63a3.38 3.38 0 0 0-3.38-3.37h-1.5a1.13 1.13 0 0 1-1.12-1.13v-1.5a3.38 3.38 0 0 0-3.38-3.37H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.62c-.62 0-1.12.5-1.12 1.13v17.25c0 .62.5 1.12 1.13 1.12h12.75c.62 0 1.12-.5 1.12-1.13v-9.37a9 9 0 0 0-9-9Z'/%3E%3C/svg%3E");
          --icon-folder-open: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' stroke='%23bbc6ce' stroke-width='1.5' viewBox='0 0 24 24'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M3.75 9.78c.11-.02.23-.03.34-.03h15.82c.11 0 .23 0 .34.03m-16.5 0a2.25 2.25 0 0 0-1.88 2.54l.85 6a2.25 2.25 0 0 0 2.23 1.93h14.1a2.25 2.25 0 0 0 2.23-1.93l.85-6a2.25 2.25 0 0 0-1.88-2.54m-16.5 0V6A2.25 2.25 0 0 1 6 3.75h3.88a1.5 1.5 0 0 1 1.06.44l2.12 2.12a1.5 1.5 0 0 0 1.06.44H18A2.25 2.25 0 0 1 20.25 9v.78'/%3E%3C/svg%3E");
          color-scheme: dark
        }
      }

      *,
      :after,
      :before {
        background-repeat: no-repeat;
        box-sizing: border-box
      }

      :after,
      :before {
        text-decoration: inherit;
        vertical-align: inherit
      }

      :where(:root) {
        -webkit-tap-highlight-color: transparent;
        -webkit-text-size-adjust: 100%;
        -moz-text-size-adjust: 100%;
        text-size-adjust: 100%;
        background-color: var(--background-color);
        color: var(--color);
        cursor: default;
        font-family: var(--font-family);
        font-size: var(--font-size);
        font-weight: var(--font-weight);
        line-height: var(--line-height);
        overflow-wrap: break-word;
        -moz-tab-size: 4;
        -o-tab-size: 4;
        tab-size: 4;
        text-rendering: optimizeLegibility
      }

      main {
        display: block
      }

      body {
        margin: 0;
        width: 100%
      }

      body>footer,
      body>header,
      body>main {
        margin-left: auto;
        margin-right: auto;
        padding: var(--block-spacing-vertical) 0;
        width: 100%
      }

      .container,
      .container-fluid {
        margin-left: auto;
        margin-right: auto;
        padding-left: var(--spacing);
        padding-right: var(--spacing);
        width: 100%
      }

      @media (min-width:576px) {
        .container {
          max-width: 510px;
          padding-left: 0;
          padding-right: 0
        }
      }

      @media (min-width:768px) {
        .container {
          max-width: 700px
        }
      }

      @media (min-width:992px) {
        .container {
          max-width: 920px
        }
      }

      @media (min-width:1200px) {
        .container {
          max-width: 1130px
        }
      }

      section {
        margin-bottom: var(--block-spacing-vertical)
      }

      b,
      strong {
        font-weight: bolder
      }

      address,
      blockquote,
      dl,
      figure,
      form,
      ol,
      p,
      pre,
      table,
      ul {
        color: var(--color);
        font-size: var(--font-size);
        font-style: normal;
        font-weight: var(--font-weight);
        margin-bottom: var(--typography-spacing-vertical);
        margin-top: 0
      }

      [role=link],
      a:not(.file-link) {
        --color: var(--primary);
        --background-color: transparent;
        background-color: var(--background-color);
        color: var(--color);
        outline: none;
        -webkit-text-decoration: var(--text-decoration);
        text-decoration: var(--text-decoration)
      }

      [role=link]:is([aria-current], :hover, :active, :focus):not(.file-link),
      a:is([aria-current], :hover, :active, :focus):not(.file-link) {
        color: var(--primary-hover);
        text-decoration: underline
      }

      [role=link]:focus:not(.file-link),
      a:focus:not(.file-link) {
        --background-color: var(--primary-focus)
      }

      h1,
      h2,
      h3,
      h4,
      h5,
      h6 {
        color: var(--color);
        font-family: var(--font-family);
        font-size: var(--font-size);
        font-weight: var(--font-weight);
        margin-bottom: var(--typography-spacing-vertical);
        margin-top: 0
      }

      h1 {
        --color: var(--h1-color)
      }

      h2 {
        --color: var(--h2-color)
      }

      h3 {
        --color: var(--h3-color)
      }

      h4 {
        --color: var(--h4-color)
      }

      h5 {
        --color: var(--h5-color)
      }

      h6 {
        --color: var(--h6-color)
      }

      :where(address, blockquote, dl, figure, form, ol, p, pre, table, ul)~:is(h1, h2, h3, h4, h5, h6) {
        margin-top: var(--typography-spacing-vertical)
      }

      p {
        margin-bottom: var(--typography-spacing-vertical)
      }

      small {
        font-size: var(--font-size)
      }

      :where(dl, ol, ul) {
        -webkit-padding-start: var(--spacing);
        -webkit-padding-end: 0;
        padding-left: var(--spacing);
        padding-right: 0;
        padding-inline-end: 0;
        padding-inline-start: var(--spacing)
      }

      :where(dl, ol, ul) li {
        margin-bottom: calc(var(--typography-spacing-vertical)*.25)
      }

      :where(dl, ol, ul) :is(dl, ol, ul) {
        margin: 0;
        margin-top: calc(var(--typography-spacing-vertical)*.25)
      }

      mark {
        background-color: var(--mark-background-color);
        color: var(--mark-color);
        padding: .125rem .25rem;
        vertical-align: baseline
      }

      ::-moz-selection {
        background-color: var(--primary-focus)
      }

      ::selection {
        background-color: var(--primary-focus)
      }

      :where(audio, canvas, iframe, img, svg, video) {
        vertical-align: middle
      }

      img {
        border-style: none;
        height: auto;
        max-width: 100%
      }

      :where(svg:not([fill])) {
        fill: currentColor
      }

      svg:not(:root) {
        overflow: hidden
      }

      legend {
        color: inherit;
        max-width: 100%;
        padding: 0;
        white-space: normal
      }

      ::-webkit-inner-spin-button,
      ::-webkit-outer-spin-button {
        height: auto
      }

      ::-moz-focus-inner {
        border-style: none;
        padding: 0
      }

      :-moz-focusring {
        outline: none
      }

      :-moz-ui-invalid {
        box-shadow: none
      }

      ::-ms-expand {
        display: none
      }

      fieldset {
        border: 0;
        margin: 0;
        margin-bottom: var(--spacing);
        padding: 0
      }

      fieldset legend,
      label {
        display: block;
        font-weight: var(--form-label-font-weight, var(--font-weight));
        margin-bottom: calc(var(--spacing)*.25)
      }

      [aria-controls] {
        cursor: pointer
      }

      [aria-disabled=true],
      [disabled] {
        cursor: not-allowed
      }

      [aria-hidden=false][hidden] {
        display: initial
      }

      [aria-hidden=false][hidden]:not(:focus) {
        clip: rect(0, 0, 0, 0);
        position: absolute
      }

      [tabindex],
      a,
      area,
      button,
      input,
      label,
      select,
      summary,
      textarea {
        -ms-touch-action: manipulation
      }

      .tree {
        --tree-spacing: 1.5rem;
        --radius: 10px;
      }

      .tree a {
        border-bottom: 1px solid transparent;
        border-color: var(--secondary);
        color: var(--color);
        text-decoration: none;
        transition: all 0.2s ease;
      }

      .tree a:hover {
        border-color: var(--secondary-hover);
        color: var(--h3-color);
      }

      .tree,
      .tree ul,
      .tree li {
        list-style: none;
        list-style-type: none;
      }

      .tree .folder li {
        display: block;
        position: relative;
        padding-left: calc(2 * var(--tree-spacing) - var(--radius) - 2px);
      }

      .tree ul {
        margin-left: calc(var(--radius) - var(--tree-spacing));
        padding-left: 0;
      }

      .tree summary {
        display: block;
        cursor: pointer;
      }

      .tree summary::marker,
      .tree summary::-webkit-details-marker {
        display: none;
      }

      .tree summary:focus {
        outline: none;
      }

      .tree summary:focus-visible {
        outline: 1px dotted #000;
      }

      .tree li.file::before {
        margin-right: 10px;
        vertical-align: middle;
        height: 20px;
        width: 20px;
        content: '';
        display: inline-block;
        background-image: var(--icon-file);
        background-position: top;
        background-size: 75% auto;
      }

      .tree li.folder>details>summary::before {
        z-index: 1;

        margin-right: 10px;
        vertical-align: middle;
        height: 20px;
        width: 20px;
        content: '';
        display: inline-block;
        background-image: var(--icon-folder);
        background-position: top;
        background-size: 75% auto;
      }

      .tree li.folder>details[open]>summary::before {
        background-image: var(--icon-folder-open);
      }
      </style>
      </head>
      <body>
        <main class="container">
          <h1>Sukka Ruleset Server</h1>
          <p>
            Made by <a href="https://skk.moe">Sukka</a> | <a href="https://github.com/SukkaW/Surge/">Source @ GitHub</a> | Licensed under <a href="/LICENSE" target="_blank">AGPL-3.0</a>
          </p>
          <p>Last Build: ${new Date().toISOString()}</p>
          <br>
          <ul class="tree">
            ${treeHtml(tree, 0, closedRootFolders)}
          </ul>
        </main>
      </body>
    </html>
  `;
}
