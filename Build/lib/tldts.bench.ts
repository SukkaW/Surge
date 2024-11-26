import { fetchRemoteTextByLine } from './fetch-text-by-line';

import { bench, group, run } from 'mitata';

import * as tldts from 'tldts';
import * as tldtsExperimental from 'tldts-experimental';

(async () => {
  const data = await Array.fromAsync(await fetchRemoteTextByLine('https://osint.digitalside.it/Threat-Intel/lists/latestdomains.txt', true));

  const tldtsOpt: Parameters<typeof tldts.getDomain>[1] = {
    allowPrivateDomains: false,
    extractHostname: false,
    validateHostname: false,
    detectIp: false,
    mixedInputs: false
  };

  (['getDomain', 'getPublicSuffix', 'getSubdomain', 'parse'] as const).forEach(methodName => {
    group(() => {
      bench('tldts', () => {
        for (let i = 0, len = data.length; i < len; i++) {
          tldts[methodName](data[i], tldtsOpt);
        }
      });

      bench('tldts-experimental', () => {
        for (let i = 0, len = data.length; i < len; i++) {
          tldtsExperimental[methodName](data[i], tldtsOpt);
        }
      });
    });
  });

  run();
})();
