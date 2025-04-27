import { never } from 'foxts/guard';
import { readFileByLine } from './fetch-text-by-line';
import { processLine } from './process-line';

export default async function runAgainstSourceFile(
  filePath: string,
  callback: (domain: string, includeAllSubDomain: boolean) => void,
  type?: 'ruleset' | 'domainset'
) {
  for await (const line of readFileByLine(filePath)) {
    const l = processLine(line);
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
      if (ruleType === 'DOMAIN') {
        callback(domain, false);
      } else if (ruleType === 'DOMAIN-SUFFIX') {
        callback(domain, true);
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
