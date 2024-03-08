// @ts-check
import { readFileByLine } from './fetch-text-by-line';
import { surgeDomainsetToClashDomainset, surgeRulesetToClashClassicalTextRuleset } from './clash';
import picocolors from 'picocolors';
import type { Span } from '../trace';
import path from 'path';

export async function compareAndWriteFile(span: Span, linesA: string[], filePath: string) {
  let isEqual = true;
  const file = Bun.file(filePath);

  const linesALen = linesA.length;

  if (!(await file.exists())) {
    console.log(`${filePath} does not exists, writing...`);
    isEqual = false;
  } else if (linesALen === 0) {
    console.log(`Nothing to write to ${filePath}...`);
    isEqual = false;
  } else {
    isEqual = await span.traceChildAsync(`comparing ${filePath}`, async () => {
      let index = 0;

      for await (const lineB of readFileByLine(file)) {
        const lineA = linesA[index];
        index++;

        if (lineA == null) {
          // The file becomes smaller
          return false;
        }

        if (lineA[0] === '#' && lineB[0] === '#') {
          continue;
        }
        if (
          lineA[0] === '/'
          && lineA[1] === '/'
          && lineB[0] === '/'
          && lineB[1] === '/'
          && lineA[3] === '#'
          && lineB[3] === '#'
        ) {
          continue;
        }

        if (lineA !== lineB) {
          return false;
        }
      }

      if (index !== linesALen) {
        // The file becomes larger
        return false;
      }

      return true;
    });
  }

  if (isEqual) {
    console.log(picocolors.dim(`same content, bail out writing: ${filePath}`));
    return;
  }

  await span.traceChildAsync(`writing ${filePath}`, async () => {
    if (linesALen < 10000) {
      return Bun.write(file, `${linesA.join('\n')}\n`);
    }

    const writer = file.writer();

    for (let i = 0; i < linesALen; i++) {
      writer.write(linesA[i]);
      writer.write('\n');
    }

    return writer.end();
  });
}

export const withBannerArray = (title: string, description: string[] | readonly string[], date: Date, content: string[]) => {
  return [
    '#########################################',
    `# ${title}`,
    `# Last Updated: ${date.toISOString()}`,
    `# Size: ${content.length}`,
    ...description.map(line => (line ? `# ${line}` : '#')),
    '#########################################',
    ...content,
    '################## EOF ##################'
  ];
};

const MARK = 'this_ruleset_is_made_by_sukkaw.ruleset.skk.moe';

export const createRuleset = (
  parentSpan: Span,
  title: string, description: string[] | readonly string[], date: Date, content: string[],
  type: 'ruleset' | 'domainset', surgePath: string, clashPath: string
) => parentSpan.traceChild(`create ruleset: ${path.basename(surgePath, path.extname(surgePath))}`).traceAsyncFn((childSpan) => {
  const surgeContent = withBannerArray(
    title, description, date,
    type === 'domainset'
      ? [MARK, ...content]
      : [`DOMAIN,${MARK}`, ...content]
  );
  const clashContent = childSpan.traceChildSync('convert incoming ruleset to clash', () => {
    let _clashContent;
    switch (type) {
      case 'domainset':
        _clashContent = [MARK, ...surgeDomainsetToClashDomainset(content)];
        break;
      case 'ruleset':
        _clashContent = [`DOMAIN,${MARK}`, ...surgeRulesetToClashClassicalTextRuleset(content)];
        break;
      default:
        throw new TypeError(`Unknown type: ${type as any}`);
    }
    return withBannerArray(title, description, date, _clashContent);
  });

  return Promise.all([
    compareAndWriteFile(childSpan, surgeContent, surgePath),
    compareAndWriteFile(childSpan, clashContent, clashPath)
  ]);
});
