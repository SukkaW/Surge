// @ts-check

import * as path from 'node:path';
import { readFileByLine } from './lib/fetch-text-by-line';
import { processLine } from './lib/process-line';
import type { Span } from './trace';
import { task } from './trace';
import { SHARED_DESCRIPTION } from './constants/description';
import { fdir as Fdir } from 'fdir';
import { appendArrayInPlace } from './lib/append-array-in-place';
import { SOURCE_DIR } from './constants/dir';
import { DomainsetOutput, RulesetOutput } from './lib/create-file';

const MAGIC_COMMAND_SKIP = '# $ custom_build_script';
const MAGIC_COMMAND_TITLE = '# $ meta_title ';
const MAGIC_COMMAND_DESCRIPTION = '# $ meta_description ';
const MAGIC_COMMAND_SGMODULE_MITM_HOSTNAMES = '# $ sgmodule_mitm_hostnames ';

const clawSourceDirPromise = new Fdir()
  .withRelativePaths()
  .filter((filepath, isDirectory) => {
    if (isDirectory) return true;

    const extname = path.extname(filepath);

    return !(extname === '.js' || extname === '.ts');
  })
  .crawl(SOURCE_DIR)
  .withPromise();

export const buildCommon = task(require.main === module, __filename)(async (span) => {
  const promises: Array<Promise<unknown>> = [];

  const paths = await clawSourceDirPromise;

  for (let i = 0, len = paths.length; i < len; i++) {
    const relativePath = paths[i];
    const fullPath = SOURCE_DIR + path.sep + relativePath;

    // if (
    //   relativePath.startsWith('ip/')
    //   || relativePath.startsWith('non_ip/')
    // ) {
    promises.push(transform(span, fullPath, relativePath));
    // continue;
    // }

    // console.error(picocolors.red(`[build-comman] Unknown file: ${relativePath}`));
  }

  return Promise.all(promises);
});

const $skip = Symbol('skip');

function processFile(span: Span, sourcePath: string) {
  return span.traceChildAsync(`process file: ${sourcePath}`, async () => {
    const lines: string[] = [];

    let title = '';
    const descriptions: string[] = [];
    let sgmodulePathname: string | null = null;

    try {
      for await (const line of readFileByLine(sourcePath)) {
        if (line.startsWith(MAGIC_COMMAND_SKIP)) {
          return $skip;
        }

        if (line.startsWith(MAGIC_COMMAND_TITLE)) {
          title = line.slice(MAGIC_COMMAND_TITLE.length).trim();
          continue;
        }

        if (line.startsWith(MAGIC_COMMAND_DESCRIPTION)) {
          descriptions.push(line.slice(MAGIC_COMMAND_DESCRIPTION.length).trim());
          continue;
        }

        if (line.startsWith(MAGIC_COMMAND_SGMODULE_MITM_HOSTNAMES)) {
          sgmodulePathname = line.slice(MAGIC_COMMAND_SGMODULE_MITM_HOSTNAMES.length).trim();
          continue;
        }

        const l = processLine(line);
        if (l) {
          lines.push(l);
        }
      }
    } catch (e) {
      console.error('Error processing', sourcePath);
      console.trace(e);
    }

    return [title, descriptions, lines, sgmodulePathname] as const;
  });
}

async function transform(parentSpan: Span, sourcePath: string, relativePath: string) {
  const extname = path.extname(sourcePath);
  const id = path.basename(sourcePath, extname);

  return parentSpan
    .traceChild(`transform ruleset: ${id}`)
    .traceAsyncFn(async (span) => {
      const type = relativePath.split(path.sep)[0];

      if (type !== 'ip' && type !== 'non_ip' && type !== 'domainset') {
        throw new TypeError(`Invalid type: ${type}`);
      }

      const res = await processFile(span, sourcePath);
      if (res === $skip) return;

      const [title, descriptions, lines, sgmodulePathname] = res;

      let finalDescriptions: string[];
      if (descriptions.length) {
        finalDescriptions = SHARED_DESCRIPTION.slice();
        finalDescriptions.push('');
        appendArrayInPlace(finalDescriptions, descriptions);
      } else {
        finalDescriptions = SHARED_DESCRIPTION;
      }

      if (type === 'domainset') {
        return new DomainsetOutput(span, id)
          .withTitle(title)
          .withDescription(finalDescriptions)
          .addFromDomainset(lines)
          .write();
      }

      return new RulesetOutput(span, id, type)
        .withTitle(title)
        .withDescription(finalDescriptions)
        .withMitmSgmodulePath(sgmodulePathname)
        .addFromRuleset(lines)
        .write();
    });
}
