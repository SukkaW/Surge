// @ts-check
import { surgeDomainsetToClashDomainset, surgeRulesetToClashClassicalTextRuleset } from './clash';
import picocolors from 'picocolors';
import type { Span } from '../trace';
import path from 'node:path';
import fs from 'node:fs';
import { fastStringArrayJoin, writeFile } from './misc';
import { readFileByLine } from './fetch-text-by-line';
import stringify from 'json-stringify-pretty-compact';
import { ipCidrListToSingbox, surgeDomainsetToSingbox, surgeRulesetToSingbox } from './singbox';
import { createTrie } from './trie';
import { pack, unpackFirst, unpackSecond } from './bitwise';
import { asyncWriteToStream } from './async-write-to-stream';

export const fileEqual = async (linesA: string[], source: AsyncIterable<string>): Promise<boolean> => {
  if (linesA.length === 0) {
    return false;
  }

  let index = -1;
  for await (const lineB of source) {
    index++;

    if (index > linesA.length - 1) {
      if (index === linesA.length && lineB === '') {
        index--;
        continue;
      }
      // The file becomes smaller
      return false;
    }

    const lineA = linesA[index];

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

  if (index !== linesA.length - 1) {
    // The file becomes larger
    return false;
  }

  return true;
};

export async function compareAndWriteFile(span: Span, linesA: string[], filePath: string) {
  let isEqual = true;
  const linesALen = linesA.length;

  if (fs.existsSync(filePath)) {
    isEqual = await fileEqual(linesA, readFileByLine(filePath));
  } else {
    console.log(`${filePath} does not exists, writing...`);
    isEqual = false;
  }

  if (isEqual) {
    console.log(picocolors.gray(picocolors.dim(`same content, bail out writing: ${filePath}`)));
    return;
  }

  await span.traceChildAsync(`writing ${filePath}`, async () => {
    // The default highwater mark is normally 16384,
    // So we make sure direct write to file if the content is
    // most likely less than 500 lines
    if (linesALen < 500) {
      return writeFile(filePath, fastStringArrayJoin(linesA, '\n') + '\n');
    }

    const writeStream = fs.createWriteStream(filePath);
    for (let i = 0; i < linesALen; i++) {
      const p = asyncWriteToStream(writeStream, linesA[i] + '\n');
      // eslint-disable-next-line no-await-in-loop -- stream high water mark
      if (p) await p;
    }

    await asyncWriteToStream(writeStream, '\n');

    writeStream.end();
  });
}

const withBannerArray = (title: string, description: string[] | readonly string[], date: Date, content: string[]) => {
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

const defaultSortTypeOrder = Symbol('defaultSortTypeOrder');
const sortTypeOrder: Record<string | typeof defaultSortTypeOrder, number> = {
  DOMAIN: 1,
  'DOMAIN-SUFFIX': 2,
  'DOMAIN-KEYWORD': 10,
  // experimental domain wildcard support
  'DOMAIN-WILDCARD': 20,
  'DOMAIN-REGEX': 21,
  'USER-AGENT': 30,
  'PROCESS-NAME': 40,
  [defaultSortTypeOrder]: 50, // default sort order for unknown type
  'URL-REGEX': 100,
  AND: 300,
  OR: 300,
  'IP-CIDR': 400,
  'IP-CIDR6': 400
};

const flagDomain = 1 << 2;
const flagDomainSuffix = 1 << 3;

// dedupe and sort based on rule type
const processRuleSet = (ruleSet: string[]) => {
  const trie = createTrie<number>(null, true);

  /** Packed Array<[valueIndex: number, weight: number]> */
  const sortMap: number[] = [];
  for (let i = 0, len = ruleSet.length; i < len; i++) {
    const line = ruleSet[i];
    const [type, value] = line.split(',');

    let extraWeight = 0;

    switch (type) {
      case 'DOMAIN':
        trie.add(value, pack(i, flagDomain));
        break;
      case 'DOMAIN-SUFFIX':
        trie.add('.' + value, pack(i, flagDomainSuffix));
        break;
      case 'URL-REGEX':
        if (value.includes('.+') || value.includes('.*')) {
          extraWeight += 10;
        }
        if (value.includes('|')) {
          extraWeight += 1;
        }
        sortMap.push(pack(i, sortTypeOrder[type] + extraWeight));
        break;
      case null:
        sortMap.push(pack(i, 10));
        break;
      default:
        if (type in sortTypeOrder) {
          sortMap.push(pack(i, sortTypeOrder[type]));
        } else {
          sortMap.push(pack(i, sortTypeOrder[defaultSortTypeOrder]));
        }
    }
  }

  const dumped = trie.dumpMeta();

  for (let i = 0, len = dumped.length; i < len; i++) {
    const originalIndex = unpackFirst(dumped[i]);
    const flag = unpackSecond(dumped[i]);

    const type = flag === flagDomain ? 'DOMAIN' : 'DOMAIN-SUFFIX';

    sortMap.push(pack(originalIndex, sortTypeOrder[type]));
  }

  return sortMap
    .sort((a, b) => unpackSecond(a) - unpackSecond(b))
    .map(c => ruleSet[unpackFirst(c)]);
};

const MARK = 'this_ruleset_is_made_by_sukkaw.ruleset.skk.moe';

export const createRuleset = (
  parentSpan: Span,
  title: string, description: string[] | readonly string[], date: Date, content: string[],
  type: 'ruleset' | 'domainset' | 'ipcidr' | 'ipcidr6',
  [surgePath, clashPath, singBoxPath, _clashMrsPath]: readonly [
    surgePath: string,
    clashPath: string,
    singBoxPath: string,
    _clashMrsPath?: string
  ]
) => parentSpan.traceChildAsync(
  `create ruleset: ${path.basename(surgePath, path.extname(surgePath))}`,
  async (childSpan) => {
    const surgeContent = childSpan.traceChildSync('process surge ruleset', () => {
      let _surgeContent;
      switch (type) {
        case 'domainset':
          _surgeContent = [MARK, ...content];
          break;
        case 'ruleset':
          _surgeContent = [`DOMAIN,${MARK}`, ...processRuleSet(content)];
          break;
        case 'ipcidr':
          _surgeContent = [`DOMAIN,${MARK}`, ...processRuleSet(content.map(i => `IP-CIDR,${i}`))];
          break;
        case 'ipcidr6':
          _surgeContent = [`DOMAIN,${MARK}`, ...processRuleSet(content.map(i => `IP-CIDR6,${i}`))];
          break;
        default:
          throw new TypeError(`Unknown type: ${type}`);
      }

      return withBannerArray(title, description, date, _surgeContent);
    });

    const clashContent = childSpan.traceChildSync('convert incoming ruleset to clash', () => {
      let _clashContent;
      switch (type) {
        case 'domainset':
          _clashContent = [MARK, ...surgeDomainsetToClashDomainset(content)];
          break;
        case 'ruleset':
          _clashContent = [`DOMAIN,${MARK}`, ...surgeRulesetToClashClassicalTextRuleset(processRuleSet(content))];
          break;
        case 'ipcidr':
        case 'ipcidr6':
          _clashContent = content;
          break;
        default:
          throw new TypeError(`Unknown type: ${type}`);
      }
      return withBannerArray(title, description, date, _clashContent);
    });
    const singboxContent = childSpan.traceChildSync('convert incoming ruleset to singbox', () => {
      let _singBoxContent;
      switch (type) {
        case 'domainset':
          _singBoxContent = surgeDomainsetToSingbox([MARK, ...processRuleSet(content)]);
          break;
        case 'ruleset':
          _singBoxContent = surgeRulesetToSingbox([`DOMAIN,${MARK}`, ...processRuleSet(content)]);
          break;
        case 'ipcidr':
        case 'ipcidr6':
          _singBoxContent = ipCidrListToSingbox(content);
          break;
        default:
          throw new TypeError(`Unknown type: ${type}`);
      }
      return stringify(_singBoxContent).split('\n');
    });

    await Promise.all([
      compareAndWriteFile(childSpan, surgeContent, surgePath),
      compareAndWriteFile(childSpan, clashContent, clashPath),
      compareAndWriteFile(childSpan, singboxContent, singBoxPath)
    ]);

  // if (clashMrsPath) {
  //   if (type === 'domainset') {
  //     await childSpan.traceChildAsync('clash meta mrs domain ' + clashMrsPath, async () => {
  //       await fs.promises.mkdir(path.dirname(clashMrsPath), { recursive: true });
  //       await convertClashMetaMrs(
  //         'domain', 'text', clashPath, clashMrsPath
  //       );
  //     });
  //   }
  // }
  }
);
