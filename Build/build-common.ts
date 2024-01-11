// @ts-check

import * as path from 'path';
import { PathScurry } from 'path-scurry';
import { readFileByLine } from './lib/fetch-text-by-line';
import { processLine } from './lib/process-line';
import { createRuleset } from './lib/create-file';
import { domainDeduper } from './lib/domain-deduper';
import { task } from './lib/trace-runner';
import { SHARED_DESCRIPTION } from './lib/constants';

const MAGIC_COMMAND_SKIP = '# $ custom_build_script';
const MAGIC_COMMAND_TITLE = '# $ meta_title ';
const MAGIC_COMMAND_DESCRIPTION = '# $ meta_description ';

const sourceDir = path.resolve(import.meta.dir, '../Source');
const outputSurgeDir = path.resolve(import.meta.dir, '../List');
const outputClashDir = path.resolve(import.meta.dir, '../Clash');

export const buildCommon = task(import.meta.path, async () => {
  const promises: Array<Promise<unknown>> = [];

  const pw = new PathScurry(sourceDir);
  for await (const entry of pw) {
    if (!entry.isFile()) {
      continue;
    }

    const extname = path.extname(entry.name);
    if (extname === '.js' || extname === '.ts') {
      continue;
    }

    const relativePath = entry.relative();
    if (relativePath.startsWith('domainset/')) {
      promises.push(transformDomainset(entry.fullpath(), relativePath));
      continue;
    }
    if (
      relativePath.startsWith('ip/')
      || relativePath.startsWith('non_ip/')
    ) {
      promises.push(transformRuleset(entry.fullpath(), relativePath));
      continue;
    }
  }

  return Promise.all(promises);
});

if (import.meta.main) {
  buildCommon();
}

const processFile = async (sourcePath: string) => {
  console.log('Processing', sourcePath);

  const lines: string[] = [];

  let title = '';
  const descriptions: string[] = [];

  try {
    for await (const line of readFileByLine(sourcePath)) {
      if (line === MAGIC_COMMAND_SKIP) {
        return;
      }

      if (line.startsWith(MAGIC_COMMAND_TITLE)) {
        title = line.slice(MAGIC_COMMAND_TITLE.length).trim();
        continue;
      }

      if (line.startsWith(MAGIC_COMMAND_DESCRIPTION)) {
        descriptions.push(line.slice(MAGIC_COMMAND_DESCRIPTION.length).trim());
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

  return [title, descriptions, lines] as const;
};

async function transformDomainset(sourcePath: string, relativePath: string) {
  const res = await processFile(sourcePath);
  if (!res) return;
  const [title, descriptions, lines] = res;

  const deduped = domainDeduper(lines);
  const description = [
    ...SHARED_DESCRIPTION,
    ...(
      descriptions.length
        ? ['', ...descriptions]
        : []
    )
  ];

  return Promise.all(createRuleset(
    title,
    description,
    new Date(),
    deduped,
    'domainset',
    path.resolve(outputSurgeDir, relativePath),
    path.resolve(outputClashDir, `${relativePath.slice(0, -path.extname(relativePath).length)}.txt`)
  ));
}

/**
 * Output Surge RULE-SET and Clash classical text format
 */
async function transformRuleset(sourcePath: string, relativePath: string) {
  const res = await processFile(sourcePath);
  if (!res) return;
  const [title, descriptions, lines] = res;

  const description = [
    ...SHARED_DESCRIPTION,
    ...(
      descriptions.length
        ? ['', ...descriptions]
        : []
    )
  ];

  return Promise.all(createRuleset(
    title,
    description,
    new Date(),
    lines,
    'ruleset',
    path.resolve(outputSurgeDir, relativePath),
    path.resolve(outputClashDir, `${relativePath.slice(0, -path.extname(relativePath).length)}.txt`)
  ));
}
