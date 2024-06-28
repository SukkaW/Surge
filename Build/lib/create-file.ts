// @ts-check
import { readFileByLine } from './fetch-text-by-line';
import { surgeDomainsetToClashDomainset, surgeRulesetToClashClassicalTextRuleset } from './clash';
import picocolors from 'picocolors';
import type { Span } from '../trace';
import path from 'path';
import { sort } from './timsort';
import { fastStringArrayJoin } from './misc';

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
    /* The `isEqual` variable is used to determine whether the content of a file is equal to the
    provided lines or not. It is initially set to `true`, and then it is updated based on different
    conditions: */
    isEqual = await span.traceChildAsync(`comparing ${filePath}`, async () => {
      let index = 0;

      for await (const lineB of readFileByLine(file)) {
        const lineA = linesA[index] as string | undefined;
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
    // if (linesALen < 10000) {
    return Bun.write(file, fastStringArrayJoin(linesA, '\n') + '\n');
    // }
    // const writer = file.writer();

    // for (let i = 0; i < linesALen; i++) {
    //   writer.write(linesA[i]);
    //   writer.write('\n');
    // }

    // return writer.end();
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

const collectType = (rule: string) => {
  let buf = '';
  for (let i = 0, len = rule.length; i < len; i++) {
    if (rule[i] === ',') {
      return buf;
    }
    buf += rule[i];
  }
  return null;
};

const defaultSortTypeOrder = Symbol('defaultSortTypeOrder');
const sortTypeOrder: Record<string | typeof defaultSortTypeOrder, number> = {
  DOMAIN: 1,
  'DOMAIN-SUFFIX': 2,
  'DOMAIN-KEYWORD': 10,
  // experimental domain wildcard support
  'DOMAIN-WILDCARD': 20,
  'USER-AGENT': 30,
  'PROCESS-NAME': 40,
  [defaultSortTypeOrder]: 50, // default sort order for unknown type
  'URL-REGEX': 100,
  AND: 300,
  OR: 300,
  'IP-CIDR': 400,
  'IP-CIDR6': 400
};
// sort DOMAIN-SUFFIX and DOMAIN first, then DOMAIN-KEYWORD, then IP-CIDR and IP-CIDR6 if any
export const sortRuleSet = (ruleSet: string[]) => {
  return sort(
    ruleSet.map((rule) => {
      const type = collectType(rule);
      if (!type) {
        return [10, rule] as const;
      }
      if (!(type in sortTypeOrder)) {
        return [sortTypeOrder[defaultSortTypeOrder], rule] as const;
      }
      if (type === 'URL-REGEX') {
        let extraWeight = 0;
        if (rule.includes('.+') || rule.includes('.*')) {
          extraWeight += 10;
        }
        if (rule.includes('|')) {
          extraWeight += 1;
        }

        return [
          sortTypeOrder[type] + extraWeight,
          rule
        ] as const;
      }
      return [sortTypeOrder[type], rule] as const;
    }),
    (a, b) => a[0] - b[0]
  ).map(c => c[1]);
};

const MARK = 'this_ruleset_is_made_by_sukkaw.ruleset.skk.moe';

export const createRuleset = (
  parentSpan: Span,
  title: string, description: string[] | readonly string[], date: Date, content: string[],
  type: 'ruleset' | 'domainset', surgePath: string, clashPath: string
) => parentSpan.traceChild(`create ruleset: ${path.basename(surgePath, path.extname(surgePath))}`).traceAsyncFn((childSpan) => {
  const surgeContent = withBannerArray(
    title, description, date,
    sortRuleSet(type === 'domainset'
      ? [MARK, ...content]
      : [`DOMAIN,${MARK}`, ...content])
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
