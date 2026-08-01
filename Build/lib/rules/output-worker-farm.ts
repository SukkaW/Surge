import type { JestWorkerFarm } from 'jest-worker';
import { createWorker } from '../worker';

type OutputWorkerModule = typeof import('./output.worker');
type OutputWorkerFarm = JestWorkerFarm<Pick<OutputWorkerModule, 'writeOutput'>>;

let farm: OutputWorkerFarm | null = null;

/**
 * Lazily boot the output worker farm. Only FileOutput#write dispatches here, and
 * only when an output crosses the offload threshold -- today that is exclusively
 * the reject domainsets / adguardhome outputs of build-reject-domainset.
 *
 * IMPORTANT: whoever triggers the lazy boot is responsible for a matching
 * endOutputWorkerFarm() (idempotent, safe to call unconditionally), otherwise the
 * worker threads keep a standalone task run alive.
 */
export function getOutputWorkerFarm(): OutputWorkerFarm {
  // 3 workers: reject, reject_extra and reject_phishing format & write in parallel
  farm ??= createWorker<OutputWorkerModule>(require.resolve('./output.worker'), 3)(['writeOutput']);
  return farm;
}

/**
 * Boot the farm ahead of time. Spawning the threads costs ~200-300ms (each loads
 * @swc-node/register and compiles the module graph), and since every big output
 * dispatches at the very end of a task, that cost otherwise lands entirely on the
 * critical path. Call this as early as the task starts so it overlaps the downloads.
 */
export function warmOutputWorkerFarm(): void {
  getOutputWorkerFarm();
}

export async function endOutputWorkerFarm(): Promise<void> {
  if (farm) {
    const f = farm;
    farm = null;
    await f.end();
  }
}
