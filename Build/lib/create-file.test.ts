import { expect } from 'chai';
import { fileEqual } from './create-file';

// eslint-disable-next-line @typescript-eslint/require-await -- async iterable
const createSource = async function *(input: string[]) {
  for (const line of input) {
    yield line;
  }
};

const test = async (a: string[], b: string[], expected: boolean) => {
  expect((await fileEqual(a, createSource(b)))).to.eq(expected);
};

describe('fileEqual', () => {
  it('same', () => test(
    ['A', 'B'],
    ['A', 'B'],
    true
  ));

  it('ignore comment', async () => {
    await test(
      ['# A', 'B'],
      ['# B', 'B'],
      true
    );

    await test(
      ['# A', '# C', 'B'],
      ['# A', '# D', 'B'],
      true
    );
  });

  it('comment more', () => test(
    ['# A', 'B'],
    ['# A', '# B', 'B'],
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
});
