import { compareAndWriteFile } from './lib/create-file';
import { task } from './trace';
import path from 'path';

const DEPRECATED_FILES = [
  ['non_ip/global_plus', 'This file has been merged with non_ip/global'],
  ['domainset/reject_sukka', 'This file has been merged with domainset/reject'],
  ['domainset/reject_phishing', 'This file has been merged with domainset/reject']
];

const outputSurgeDir = path.resolve(import.meta.dir, '../List');
const outputClashDir = path.resolve(import.meta.dir, '../Clash');

export const buildDeprecateFiles = task(import.meta.path, (span) => span.traceChildAsync('create deprecated files', async (childSpan) => {
  const promises: Array<Promise<unknown>> = [];

  for (const [filePath, description] of DEPRECATED_FILES) {
    const surgeFile = path.resolve(outputSurgeDir, `${filePath}.conf`);
    const clashFile = path.resolve(outputClashDir, `${filePath}.txt`);

    const content = [
      '#########################################',
      '# Sukka\'s Ruleset - Deprecated',
      `# ${description}`,
      '################## EOF ##################'
    ];

    promises.push(
      compareAndWriteFile(childSpan, content, surgeFile),
      compareAndWriteFile(childSpan, content, clashFile)
    );
  }

  return Promise.all(promises);
}));

if (import.meta.main) {
  buildDeprecateFiles();
}
