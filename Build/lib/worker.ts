import process from 'node:process';
import type { JestWorkerFarm } from 'jest-worker';
import { Worker as JestWorker } from 'jest-worker';

const sharedWorkerOptions = {
  enableWorkerThreads: true,
  forkOptions: {
    env: {
      ...process.env,
      NODE_OPTIONS: process.env.NODE_OPTIONS
    }
  }
} satisfies ConstructorParameters<typeof JestWorker>[1];

export function createWorker<T extends Record<string, unknown>>(workerPath: string, numWorkers = 1) {
  return <const K extends ReadonlyArray<keyof T & string>>(exposedMethods: K): JestWorkerFarm<Pick<T, K[number]>> => {
    const worker = new JestWorker(workerPath, {
      ...sharedWorkerOptions,
      numWorkers,
      exposedMethods
    }) as JestWorkerFarm<Pick<T, K[number]>>;

    worker.getStdout().pipe(process.stdout);
    worker.getStderr().pipe(process.stderr);

    return worker;
  };
}
