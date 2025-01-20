import { describe, it } from 'mocha';

import { processLine } from './process-line';
import expect from 'expect';

describe('processLine', () => {
  ([
    ['! comment', null],
    ['  ! comment', null],
    ['// xommwnr', null],
    ['# comment', null],
    ['   # comment', null],
    ['###id', '###id'],
    ['##.class', '##.class'],
    ['## EOF', '## EOF']
  ] as const).forEach(([input, expected]) => {
    it(input, () => {
      expect(processLine(input)).toBe(expected);
    });
  });
});
