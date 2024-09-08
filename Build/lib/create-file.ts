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
import { pack, unpack } from './bitwise';

export async function compareAndWriteFile(span: Span, linesA: string[], filePath: string) {
  let isEqual = true;
  const linesALen = linesA.length;

  if (!fs.existsSync(filePath)) {
    console.log(`${filePath} does not exists, writing...`);
    isEqual = false;
  } else if (linesALen === 0) {
    console.log(`Nothing to write to ${filePath}...`);
    isEqual = false;
  } else {
    isEqual = await span.traceChildAsync(`comparing ${filePath}`, async () => {
      let index = 0;
      for await (const lineB of readFileByLine(filePath)) {
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
    return writeFile(filePath, fastStringArrayJoin(linesA, '\n') + '\n');
    // }
    // const writer = file.writer();

    // for (let i = 0; i < linesALen; i++) {
    //   writer.write(linesA[i]);
    //   writer.write('\n');
    // }

    // return writer.end();
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

  const sortMap: Array<[value: number, weight: number]> = [];
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
        sortMap.push([i, sortTypeOrder[type] + extraWeight]);
        break;
      case null:
        sortMap.push([i, 10]);
        break;
      default:
        if (type in sortTypeOrder) {
          sortMap.push([i, sortTypeOrder[type]]);
        } else {
          sortMap.push([i, sortTypeOrder[defaultSortTypeOrder]]);
        }
    }
  }

  const dumped = trie.dumpWithMeta();
  for (let i = 0, len = dumped.length; i < len; i++) {
    const [originalIndex, flag] = unpack(dumped[i][1]);
    const type = flag === flagDomain ? 'DOMAIN' : 'DOMAIN-SUFFIX';

    sortMap.push([originalIndex, sortTypeOrder[type]]);
  }

  return sortMap
    .sort((a, b) => a[1] - b[1])
    .map(c => ruleSet[c[0]]);
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
) => parentSpan.traceChild(`create ruleset: ${path.basename(surgePath, path.extname(surgePath))}`).traceAsyncFn(async (childSpan) => {
  content = processRuleSet(content);
  const surgeContent = childSpan.traceChildSync('process surge ruleset', () => {
    let _surgeContent;
    switch (type) {
      case 'domainset':
        _surgeContent = [MARK, ...content];
        break;
      case 'ruleset':
        _surgeContent = [`DOMAIN,${MARK}`, ...content];
        break;
      case 'ipcidr':
        _surgeContent = [`DOMAIN,${MARK}`, ...content.map(i => `IP-CIDR,${i}`)];
        break;
      case 'ipcidr6':
        _surgeContent = [`DOMAIN,${MARK}`, ...content.map(i => `IP-CIDR6,${i}`)];
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
        _clashContent = [`DOMAIN,${MARK}`, ...surgeRulesetToClashClassicalTextRuleset(content)];
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
        _singBoxContent = surgeDomainsetToSingbox([MARK, ...content]);
        break;
      case 'ruleset':
        _singBoxContent = surgeRulesetToSingbox([`DOMAIN,${MARK}`, ...content]);
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
});
