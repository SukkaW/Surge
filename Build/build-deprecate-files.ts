import { OUTPUT_CLASH_DIR, OUTPUT_SURGE_DIR, PUBLIC_DIR } from './constants/dir';
import { compareAndWriteFile } from './lib/create-file';
import { task } from './trace';
import path from 'node:path';
import fsp from 'node:fs/promises';
import { globSync } from 'tinyglobby';
import { appendArrayInPlace } from 'foxts/append-array-in-place';

const DEPRECATED_FILES = [
  ['non_ip/global_plus', 'This file has been merged with non_ip/global'],
  ['domainset/reject_sukka', 'This file has been merged with domainset/reject']
];

const REMOVED_FILES = [
  'Internal/chnroutes.txt',
  'List/internal/appprofile.php',
  'Clash/domainset/steam.txt',
  'Clash/non_ip/clash_fake_ip_filter.txt',
  'sing-box/domainset/steam.json',
  'Modules/sukka_unlock_abema.sgmodule',
  'Modules/sukka_exclude_reservered_ip.sgmodule',
  'Modules/Rules/*.sgmodule',
  'Internal/mihomo_nameserver_policy/*.conf'
];

const REMOVED_FOLDERS = [
  'List/Internal',
  'Clash/Internal'
];

export const buildDeprecateFiles = task(require.main === module, __filename)((span) => span.traceChildAsync('create deprecated files', async (childSpan) => {
  const promises: Array<Promise<unknown>> = globSync(REMOVED_FILES, { cwd: PUBLIC_DIR, absolute: true })
    .map(f => fsp.rm(f, { force: true, recursive: true }));

  appendArrayInPlace(promises, REMOVED_FOLDERS.map(folder => fsp.rm(path.join(PUBLIC_DIR, folder), { force: true, recursive: true })));

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
