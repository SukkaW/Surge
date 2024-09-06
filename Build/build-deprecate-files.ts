import { OUTPUT_CLASH_DIR, OUTPUT_SURGE_DIR } from './constants/dir';
import { compareAndWriteFile } from './lib/create-file';
import { task } from './trace';
import path from 'node:path';

const DEPRECATED_FILES = [
  ['non_ip/global_plus', 'This file has been merged with non_ip/global'],
  ['domainset/reject_sukka', 'This file has been merged with domainset/reject'],
  ['domainset/reject_phishing', 'This file has been merged with domainset/reject']
];

export const buildDeprecateFiles = task(require.main === module, __filename)((span) => span.traceChildAsync('create deprecated files', async (childSpan) => {
  const promises: Array<Promise<unknown>> = [];

  for (const [filePath, description] of DEPRECATED_FILES) {
    const surgeFile = path.resolve(OUTPUT_SURGE_DIR, `${filePath}.conf`);
    const clashFile = path.resolve(OUTPUT_CLASH_DIR, `${filePath}.txt`);

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
