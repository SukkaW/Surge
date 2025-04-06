import { expect } from 'expect';
import { fileEqual } from './create-file';

// eslint-disable-next-line @typescript-eslint/require-await -- async iterable
async function *createSource(input: string[]) {
  for (const line of input) {
    yield line;
  }
}

async function test(a: string[], b: string[], expected: boolean) {
  expect((await fileEqual(a, createSource(b)))).toBe(expected);
}

describe('fileEqual', () => {
  it('same', () => test(
    ['A', 'B'],
    ['A', 'B'],
    true
  ));

  it('ignore comment 1', async () => {
    await test(
      ['# A', 'B'],
      ['# B', 'B'],
      true
    );
  });

  it('ignore comment 2', () => test(
    ['# A', '# C', 'B'],
    ['# A', '# D', 'B'],
    true
  ));

  it('ignore comment 3', () => test(
    ['# A', '# C', 'B'],
    ['# A', '# D', 'A'],
    false
  ));

  it('comment more', () => test(
    ['# A', 'B'],
    ['# A', '# B', 'B'],
    false
  ));

  it('comment less', () => test(
    ['# A', '# B', 'B'],
    ['# A', 'B'],
    false
  ));

  it('larger', () => test(
    ['A', 'B'],
    ['A', 'B', 'C'],
    false
  ));

  it('smaller', () => test(
    ['A', 'B', 'C'],
    ['A', 'B'],
    false
  ));

  it('eol more #1', () => test(
    ['A', 'B'],
    ['A', 'B', ''],
    false
  ));

  it('eol more #2', () => test(
    ['A', 'B', ''],
    ['A', 'B', '', ''],
    false
  ));

  it('eol less #1', () => test(
    ['A', 'B', ''],
    ['A', 'B'],
    false
  ));

  it('eol less #2', () => test(
    ['A', 'B', '', ''],
    ['A', 'B', ''],
    false
  ));
});
