import picocolors from 'picocolors';

type Formatter = (result: string) => string;

export function traceSync<T>(prefix: string, fn: () => T, timeFormatter: Formatter = picocolors.blue): T {
  const start = Bun.nanoseconds();
  const result = fn();
  const end = Bun.nanoseconds();
  console.log(`${timeFormatter(`[${((end - start) / 1e6).toFixed(3)}ms]`)} ${prefix}`);
  return result;
}
traceSync.skip = <T>(_prefix: string, fn: () => T): T => fn();

export const traceAsync = async <T>(prefix: string, fn: () => Promise<T>, timeFormatter: Formatter = picocolors.blue): Promise<T> => {
  const start = Bun.nanoseconds();
  const result = await fn();
  const end = Bun.nanoseconds();
  console.log(`${timeFormatter(`[${((end - start) / 1e6).toFixed(3)}ms]`)} ${prefix}`);
  return result;
};

export interface TaskResult {
  readonly start: number,
  readonly end: number,
  readonly taskName: string
}
