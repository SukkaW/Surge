import { describe, it } from 'mocha';
import { expect } from 'expect';
import { getFns } from './aho-corasick.bench';

describe('AhoCorasick', () => {
  for (const test of ([
    [
      ['ap', 'an'],
      ['bananan', 'apple', 'melon'],
      [true, true, false]
    ],
    [
      ['cdn', 'sukka'],
      ['bananan', 'apple', 'melon'],
      [false, false, false]
    ]
  ] as const)) {
    const kwtests = getFns(test[0]);
    const fixtures = test[1];
    const expected = test[2];

    for (const kwtest of kwtests) {
      const fnName = kwtest[0];
      const fn = kwtest[1];

      it(fnName, () => {
        for (let i = 0, len = fixtures.length; i < len; i++) {
          expect(fn(fixtures[i])).toBe(expected[i]);
        }
      });
    }
  }
});
