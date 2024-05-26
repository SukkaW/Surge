import { fetchRemoteTextByLine } from './fetch-text-by-line';
import { processLineFromReadline } from './process-line';

import { bench, group, run } from 'mitata';

import * as tldts from 'tldts';
import * as tldtsExperimental from 'tldts-experimental';
import { getGorhillPublicSuffixPromise } from './get-gorhill-publicsuffix';

(async () => {
  const data = await processLineFromReadline(await fetchRemoteTextByLine('https://osint.digitalside.it/Threat-Intel/lists/latestdomains.txt'));

  const gorhill = await getGorhillPublicSuffixPromise();
  const tldtsOpt: Parameters<typeof tldts.getDomain>[1] = {
    allowPrivateDomains: false,
    extractHostname: false,
    validateHostname: false,
    detectIp: false,
    mixedInputs: false
  };

  (['getDomain', 'getPublicSuffix', 'getSubdomain'] as const).forEach(methodName => {
    group(methodName, () => {
      if (methodName in gorhill) {
        bench('gorhill', () => {
          for (let i = 0, len = data.length; i < len; i++) {
            const line = data[i];
            const safeGorhillLine = line[0] === '.' ? line.slice(1) : line;

            // @ts-expect-error -- type guarded
            gorhill[methodName](safeGorhillLine);
          }
        });
      }

      bench('tldts', () => {
        for (let i = 0, len = data.length; i < len; i++) {
          // eslint-disable-next-line import-x/namespace -- safe
          tldts[methodName](data[i], tldtsOpt);
        }
      });

      bench('tldts-experimental', () => {
        for (let i = 0, len = data.length; i < len; i++) {
          // eslint-disable-next-line import-x/namespace -- safe
          tldtsExperimental[methodName](data[i], tldtsOpt);
        }
      });
    });
  });

  run();
})();
