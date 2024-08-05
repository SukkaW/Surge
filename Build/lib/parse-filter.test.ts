import { describe, it } from 'mocha';

import { processFilterRules } from './parse-filter';
import { createCacheKey } from './cache-filesystem';
import { createSpan } from '../trace';

const cacheKey = createCacheKey(__filename);

describe('processFilterRules', () => {
  it('https://filters.adtidy.org/extension/ublock/filters/18_optimized.txt', () => {
    console.log(processFilterRules(
      createSpan('noop'),
      cacheKey('https://filters.adtidy.org/extension/ublock/filters/18_optimized.txt'),
      [],
      7_200_000
    ));
  });
});
