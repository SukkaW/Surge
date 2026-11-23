/* eslint-disable no-await-in-loop -- sequential polling */
'use strict';

const process = require('node:process');
const { setTimeout: sleep } = require('node:timers/promises');

const MAX_ATTEMPTS = 75;
const INTERVAL = 4 * 1000;

(async () => {
  const { INPUT_URL: url, INPUT_EXPECTED: expected } = process.env;
  if (!url || !expected) {
    console.error('Both `url` and `expected` inputs are required');
    process.exitCode = 1;
    return;
  }

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(INTERVAL) });
      // The marker is written with `echo`, which appends a trailing newline
      const content = (await res.text()).trim();
      if (content === expected && res.ok) {
        console.log(`${url} is serving the correct deploy marker`);
        return;
      }
      console.log(`[${attempt}/${MAX_ATTEMPTS}] HTTP ${res.status}: ${content.slice(0, 120)}`);
    } catch (e) {
      console.log(`[${attempt}/${MAX_ATTEMPTS}]`, e);
    }
    if (attempt < MAX_ATTEMPTS) {
      await sleep(INTERVAL);
    }
  }

  console.error(`Timed out waiting for ${url}`);
  process.exitCode = 1;
})();
