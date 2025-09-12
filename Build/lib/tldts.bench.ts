import { fetchRemoteTextByLine } from './fetch-text-by-line';

import { bench, group, run } from 'mitata';

import * as tldts from 'tldts';
import * as tldtsExperimental from 'tldts-experimental';

(async () => {
  const data = await Array.fromAsync(await fetchRemoteTextByLine('https://phishing.army/download/phishing_army_blocklist.txt', true));

  const tldtsOpt: Parameters<typeof tldts.getDomain>[1] = {
    allowPrivateDomains: false,
    extractHostname: false,
    validateHostname: false,
    detectIp: false,
    mixedInputs: false
  };

  (['getDomain', 'getPublicSuffix', 'getSubdomain', 'parse'] as const).forEach(methodName => {
    group(() => {
      bench('tldts - ' + methodName, () => {
        for (let i = 0, len = data.length; i < len; i++) {
          tldts[methodName](data[i], tldtsOpt);
        }
      });

      bench('tldts-experimental - ' + methodName, () => {
        for (let i = 0, len = data.length; i < len; i++) {
          tldtsExperimental[methodName](data[i], tldtsOpt);
        }
      });
    });
  });

  return run();
})();
