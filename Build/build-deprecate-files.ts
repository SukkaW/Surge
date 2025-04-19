import { OUTPUT_CLASH_DIR, OUTPUT_SURGE_DIR, PUBLIC_DIR } from './constants/dir';
import { compareAndWriteFile } from './lib/create-file';
import { task } from './trace';
import path from 'node:path';
import fsp from 'node:fs/promises';

const DEPRECATED_FILES = [
  ['non_ip/global_plus', 'This file has been merged with non_ip/global'],
  ['domainset/reject_sukka', 'This file has been merged with domainset/reject']
];

const REMOVED_FILES = [
  'Internal/cdn.txt',
  'List/internal/appprofile.php',
  'Clash/domainset/steam.txt',
  'Clash/non_ip/clash_fake_ip_filter.txt',
  'sing-box/domainset/steam.json',
  'Modules/sukka_unlock_abema.sgmodule',
  'Modules/sukka_exclude_reservered_ip.sgmodule'
];

export const buildDeprecateFiles = task(require.main === module, __filename)((span) => span.traceChildAsync('create deprecated files', async (childSpan) => {
  const promises: Array<Promise<unknown>> = REMOVED_FILES
    .map(f => fsp.rm(
      path.join(PUBLIC_DIR, f),
      { force: true, recursive: true }
    ));

  for (const [filePath, description] of DEPRECATED_FILES) {
    const content = [
      '#########################################',
      '# Sukka\'s Ruleset - Deprecated',
      `# ${description}`,
      '################## EOF ##################'
    ];

    promises.push(
      compareAndWriteFile(childSpan, content, path.resolve(OUTPUT_SURGE_DIR, `${filePath}.conf`)),
      compareAndWriteFile(childSpan, content, path.resolve(OUTPUT_CLASH_DIR, `${filePath}.txt`))
    );
  }

  return Promise.all(promises);
}));
