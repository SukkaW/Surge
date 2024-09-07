import { OUTPUT_CLASH_DIR, OUTPUT_SURGE_DIR, PUBLIC_DIR } from './constants/dir';
import { compareAndWriteFile } from './lib/create-file';
import { task } from './trace';
import path from 'node:path';
import fsp from 'node:fs/promises';

const DEPRECATED_FILES = [
  ['non_ip/global_plus', 'This file has been merged with non_ip/global'],
  ['domainset/reject_sukka', 'This file has been merged with domainset/reject'],
  ['domainset/reject_phishing', 'This file has been merged with domainset/reject']
];

const REMOVED_FILES = [
  'Internal/cdn.txt',
  'List/domainset/steam.conf',
  'List/internal/appprofile.php',
  'Clash/domainset/steam.txt',
  'sing-box/domainset/steam.json'
];

export const buildDeprecateFiles = task(require.main === module, __filename)((span) => span.traceChildAsync('create deprecated files', async (childSpan) => {
  const promises: Array<Promise<unknown>> = REMOVED_FILES
    .map(f => fsp.rm(
      path.join(PUBLIC_DIR, f),
      { force: true, recursive: true }
    ));

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
