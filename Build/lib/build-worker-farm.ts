import type { JestWorkerFarm } from 'jest-worker';
import { createWorker } from './worker';
import { once } from 'foxts/once';

type BuildWorkerModule = typeof import('./build.worker');
type BuildWorkerFarm = JestWorkerFarm<BuildWorkerModule>;

/**
 * Every thread costs ~250ms of CPU to boot (Node + @swc-node/register + the module
 * graph), and CI has 4 cores. One farm of 3 threads plus the main thread fills
 * them exactly, and 3 is enough because the two phases that use the farm do not
 * overlap and each needs at most 3 threads at once:
 *
 *   early:  getRejectSources | getPhishingDomains | buildMicrosoftCdn -> buildCdnDownloadConf
 *   late:   writeOutput reject | reject_extra | reject_phishing -> reject-adguardhome
 *
 * jest-worker holds a lock per in-flight call, so a 4th concurrent call queues
 * behind the first thread to free up; in the early phase that is the ~0.3s
 * cdn-download-conf job waiting for the ~0.75s microsoft-cdn job, both well
 * inside the ~2.4s the reject sources take on the critical path.
 */
const NUM_WORKERS = 3;

/**
 * IMPORTANT: whoever triggers the lazy boot is responsible for a matching
 * endBuildWorkerFarm() (idempotent, safe to call unconditionally), otherwise the
 * worker threads keep a standalone task run alive.
 */
export const getBuildWorkerFarm = once((): BuildWorkerFarm => createWorker<BuildWorkerModule>(require.resolve('./build.worker'), NUM_WORKERS)([
  'writeOutput',
  'getPhishingDomains',
  'getRejectSources',
  'buildMicrosoftCdn',
  'buildCdnDownloadConf'
]), false /* warm manually */);

/**
 * Boot the farm ahead of time so the thread spin-up overlaps with whatever the
 * main thread is doing first, instead of landing on the critical path of the
 * first job dispatched to it.
 */
export function warmBuildWorkerFarm(): void {
  getBuildWorkerFarm();
}

export async function endBuildWorkerFarm(): Promise<void> {
  const farm = getBuildWorkerFarm();
  await farm.end();
}
