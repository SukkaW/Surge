import path from 'path';

const traceSync = <T>(prefix: string, fn: () => T): T => {
  const start = performance.now();
  const result = fn();
  const end = performance.now();
  console.log(`${prefix}: ${(end - start).toFixed(3)}ms`);
  return result;
};
export { traceSync };

const traceAsync = async <T>(prefix: string, fn: () => Promise<T>): Promise<T> => {
  const start = performance.now();
  const result = await fn();
  const end = performance.now();
  console.log(`${prefix}: ${(end - start).toFixed(3)}ms`);
  return result;
};
export { traceAsync };

export interface TaskResult {
  readonly start: number,
  readonly end: number,
  readonly taskName: string
}

const task = <T>(importMetaPath: string, fn: () => Promise<T>, customname: string | null = null) => {
  const taskName = customname ?? path.basename(importMetaPath, path.extname(importMetaPath));
  return async () => {
    console.log(`🏃 [${taskName}] Start executing`);
    const start = performance.now();
    await fn();
    const end = performance.now();
    console.log(`✅ [${taskName}] Executed successfully: ${(end - start).toFixed(3)}ms`);

    return { start, end, taskName } as TaskResult;
  };
};
export { task };
