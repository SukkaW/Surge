import Worktank from 'worktank';
import os from 'node:os';
import process from 'node:process';
import type { Span } from '../trace';

const pool = new Worktank({
  name: 'process-phishing-domains',
  size: Math.max(2, Math.max(1, ('availableParallelism' in os ? os.availableParallelism() : (os as typeof import('node:os')).cpus().length) - 1)),
  timeout: 10000, // The maximum number of milliseconds to wait for the result from the worker, if exceeded the worker is terminated and the execution promise rejects
  warmup: true,
  autoterminate: 30000, // The interval of milliseconds at which to check if the pool can be automatically terminated, to free up resources, workers will be spawned up again if needed
  env: {},
  methods: {
    // eslint-disable-next-line object-shorthand -- workertank
    compareAndWriteFile: async function (
      linesA: string[], filePath: string,
      importMetaUrl: string
    ): Promise<void> {
      const { default: module } = await import('node:module');
      const __require = module.createRequire(importMetaUrl);

      const fs = __require('fs') as typeof import('fs');
      const { readFileByLine } = __require('./fetch-text-by-line') as typeof import('./fetch-text-by-line');
      const { fileEqual } = __require('./create-file') as typeof import('./create-file');
      const path = __require('node:path') as typeof import('node:path');
      const { fastStringArrayJoin } = __require('foxts/fast-string-array-join') as typeof import('foxts/fast-string-array-join');
      const picocolors = __require('picocolors') as typeof import('picocolors');

      let isEqual = false;
      if (fs.existsSync(filePath)) {
        isEqual = await fileEqual(linesA, readFileByLine(filePath));
      } else {
        console.log(`${filePath} does not exists, writing...`);
        // isEqual = false; // isEqual is false by default anyway
      }

      if (isEqual) {
        console.log(picocolors.gray(picocolors.dim(`same content, bail out writing: ${filePath}`)));
        return;
      }

      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(filePath, fastStringArrayJoin(linesA, '\n') + '\n', { encoding: 'utf-8' });
    }
  }
});

export function compareAndWriteFileInWorker(span: Span, linesA: string[], filePath: string) {
  return span.traceChildAsync(`compare and write (worker) ${filePath}`, () => pool.exec('compareAndWriteFile', [linesA, filePath, import.meta.url]));
}

process.on('beforeExit', () => pool.terminate());
