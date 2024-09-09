import { describe, it } from 'mocha';

import { parse, processFilterRules, type ParseType } from './parse-filter';
import { createCacheKey } from './cache-filesystem';
import { createSpan } from '../trace';

const cacheKey = createCacheKey(__filename);

describe('parse', () => {
  const MUTABLE_PARSE_LINE_RESULT: [string, ParseType] = ['', 1000];

  it('||top.mail.ru^$badfilter', () => {
    console.log(parse('||top.mail.ru^$badfilter', MUTABLE_PARSE_LINE_RESULT));
  });
});

describe.skip('processFilterRules', () => {
  it('https://filters.adtidy.org/extension/ublock/filters/18_optimized.txt', () => {
    console.log(processFilterRules(
      createSpan('noop'),
      cacheKey('https://filters.adtidy.org/extension/ublock/filters/18_optimized.txt'),
      [],
      7_200_000
    ));
  });
});
