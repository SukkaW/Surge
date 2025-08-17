import { never } from 'foxts/guard';
import { readFileByLine } from './fetch-text-by-line';
import { processLine } from './process-line';

export default async function runAgainstSourceFile(
  filePath: string,
  callback: (domain: string, includeAllSubDomain: boolean) => void,
  type?: 'ruleset' | 'domainset',
  /** Secret keyword collection, only use for special purpose */
  keywordSet?: Set<string> | null
) {
  let l: string | null = '';
  for await (const line of readFileByLine(filePath)) {
    l = processLine(line);
    if (!l) {
      continue;
    }
    if (type == null) {
      if (l.includes(',')) {
        type = 'ruleset';
      } else {
        type = 'domainset';
      }
    }

    if (type === 'ruleset') {
      const [ruleType, domain] = l.split(',', 3);
      switch (ruleType) {
        case 'DOMAIN': {
          callback(domain, false);
          break;
        }
        case 'DOMAIN-SUFFIX': {
          callback(domain, true);
          break;
        }
        case 'DOMAIN-KEYWORD': {
          if (keywordSet) {
            keywordSet.add(domain);
          }
          break;
        }
        // no default
      }
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- exhaus options
    } else if (type === 'domainset') {
      if (l[0] === '.') {
        callback(l.slice(1), true);
      } else {
        callback(l, false);
      }
    } else {
      never(type);
    }
  }
}
