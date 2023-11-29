// @ts-check
import { readFileByLine } from './fetch-remote-text-by-line';
import { surgeDomainsetToClashDomainset, surgeRulesetToClashClassicalTextRuleset } from './clash';

export async function compareAndWriteFile(linesA: string[], filePath: string) {
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
    let index = 0;

    for await (const lineB of readFileByLine(file)) {
      const lineA = linesA[index];
      index++;

      if (lineA === undefined) {
        // The file becomes smaller
        isEqual = false;
        break;
      }

      if (lineA[0] === '#' && lineB[0] === '#') {
        continue;
      }

      if (lineA !== lineB) {
        isEqual = false;
        break;
      }
    }

    if (index !== linesALen) {
      // The file becomes larger
      isEqual = false;
    }
  }

  if (isEqual) {
    console.log(`Same Content, bail out writing: ${filePath}`);
    return;
  }

  const writer = file.writer();

  for (let i = 0; i < linesALen; i++) {
    writer.write(`${linesA[i]}\n`);
  }

  return writer.end();
}

export const withBannerArray = (title: string, description: string[], date: Date, content: string[]) => {
  return [
    '########################################',
    `# ${title}`,
    `# Last Updated: ${date.toISOString()}`,
    `# Size: ${content.length}`,
    ...description.map(line => (line ? `# ${line}` : '#')),
    '########################################',
    ...content,
    '################# END ###################'
  ];
};

export const createRuleset = (
  title: string, description: string[], date: Date, content: string[],
  type: 'ruleset' | 'domainset', surgePath: string, clashPath: string
) => {
  const surgeContent = withBannerArray(title, description, date, content);

  let _clashContent;
  switch (type) {
    case 'domainset':
      _clashContent = surgeDomainsetToClashDomainset(content);
      break;
    case 'ruleset':
      _clashContent = surgeRulesetToClashClassicalTextRuleset(content);
      break;
    default:
      throw new TypeError(`Unknown type: ${type}`);
  }

  const clashContent = withBannerArray(title, description, date, _clashContent);

  return [
    compareAndWriteFile(surgeContent, surgePath),
    compareAndWriteFile(clashContent, clashPath)
  ];
};
