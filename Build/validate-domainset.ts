// Surge Domain Set can not include root domain from public suffix list.

import * as tldts from 'tldts'; // hit ratio way too low, dont cache
import picocolors from 'picocolors';
import path from 'path';
import listDir from '@sukka/listdir';
import { readFileByLine } from './lib/fetch-remote-text-by-line';
import { processLine } from './lib/process-line';
import { task } from './lib/trace-runner';

const SPECIAL_SUFFIXES = new Set([
  'linodeobjects.com', // only *.linodeobjects.com are public suffix
  'vultrobjects.com', // only *.vultrobjects.com are public suffix
  'dweb.link' // only *.dweb.link are public suffix
]);

const validateDomainSet = async (filePath: string) => {
  for await (const l of readFileByLine(path.resolve(__dirname, '../List/domainset', filePath))) {
    // starts with #
    const line = processLine(l);
    if (!line) {
      continue;
    }
    const domain = line[0] === '.' ? line.slice(1) : line;
    const parsed = tldts.parse(domain, { allowPrivateDomains: true, detectIp: false });

    if (
      (
        parsed.isPrivate
        || parsed.isIcann
      ) && domain === parsed.publicSuffix
    ) {
      console.error(`[${filePath}]`, picocolors.yellow(domain), picocolors.red('is in public suffix list!'));
    }
  }
};

const _validateRuleset = async (filePath: string) => {
  console.log(`[${filePath}]`);

  for await (const l of readFileByLine(path.resolve(__dirname, '../List/non_ip', filePath))) {
    // starts with #
    const line = processLine(l);
    if (!line) {
      continue;
    }
    if (!line.startsWith('DOMAIN-SUFFIX,')) {
      continue;
    }
    const domain = line.slice(14);
    const parsed = tldts.parse(domain, { allowPrivateDomains: true, detectIp: false });

    if (domain !== parsed.publicSuffix) {
      if (!SPECIAL_SUFFIXES.has(domain)) {
        console.warn(picocolors.yellow(domain), picocolors.green('is not in public suffix list!'));
      }
    }
  }
};

export const validate = task(__filename, async () => {
  // const [domainsetFiles, _rulesetFiles] = await Promise.all([
  //   listDir(path.resolve(__dirname, '../List/domainset')),
  //   listDir(path.resolve(__dirname, '../List/non_ip'))
  // ]);
  return Promise.all([
    listDir(path.resolve(__dirname, '../List/domainset'))
      .then(domainsetFiles => Promise.all(domainsetFiles.map(file => validateDomainSet(file))))
    // rulesetFiles.map(file => validateRuleset(file))
  ]);
});

if (import.meta.main) {
  validate();
}
