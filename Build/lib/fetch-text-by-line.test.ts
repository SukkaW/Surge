import { describe, it } from 'mocha';
import { expect } from 'earl';
import { TextLineStream } from 'foxts/text-line-stream';

import { splitTextIntoLines } from './fetch-text-by-line';
import { ProcessLineStream } from './process-line';

/** The streaming pipeline splitTextIntoLines replaces, for equivalence checks */
async function viaStream(text: string, processLine: boolean, chunkSize: number): Promise<string[]> {
  let stream = new ReadableStream<string>({
    start(controller) {
      for (let i = 0; i < text.length; i += chunkSize) {
        controller.enqueue(text.slice(i, i + chunkSize));
      }
      controller.close();
    }
  }).pipeThrough(new TextLineStream({ skipEmptyLines: processLine }));
  if (processLine) {
    stream = stream.pipeThrough(new ProcessLineStream());
  }
  return Array.fromAsync(stream);
}

const SAMPLES = [
  '',
  'single line without newline',
  'a\nb\nc\n',
  'a\nb\nc',
  'a\r\nb\r\n\r\nc\r\n',
  '\n\n\n',
  '\r\n',
  '# comment\n  padded  \n\n! adguard comment\n0.0.0.0 example.com\n\n'
];

const CHUNK_SIZES = [1, 3, 1024];

describe('splitTextIntoLines', () => {
  [false, true].forEach((processLine) => {
    it(`matches the TextLineStream pipeline (processLine=${processLine})`, async () => {
      for (let i = 0, len = SAMPLES.length; i < len; i++) {
        for (let j = 0, jlen = CHUNK_SIZES.length; j < jlen; j++) {
          // eslint-disable-next-line no-await-in-loop -- sequential equivalence checks
          expect(splitTextIntoLines(SAMPLES[i], processLine)).toEqual(await viaStream(SAMPLES[i], processLine, CHUNK_SIZES[j]));
        }
      }
    });
  });

  it('drops a lone trailing CR on an unterminated last line (TextLineStream keeps it -- a flush quirk, not a feature)', () => {
    expect(splitTextIntoLines('a\r\nb\r', false)).toEqual(['a', 'b']);
  });

  it('applies the filter before processLine and lets it rewrite lines', () => {
    const lines = splitTextIntoLines('keep\n  drop me \nrewrite\n', true, line => (line.includes('drop') ? null : line.toUpperCase()));
    expect(lines).toEqual(['KEEP', 'REWRITE']);
  });
});
