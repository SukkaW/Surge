import { workerJob } from '../../trace';
import type { RawSpan, WorkerJobResult } from '../../trace';
import { resolveStrategyOutputPath, reviveStrategy, writeDataToStrategies } from './strategy-write-data';
import type { OutputWorkerPayload } from './strategy-write-data';

/**
 * The off-main-thread half of FileOutput#write. Everything from "raw collections"
 * to "bytes on disk" happens here: punycode, keyword filtering, sorting, the
 * per-strategy format fanout (incl. the sing-box JSON stringify), banner and
 * content hash, compare and write. All fs calls are synchronous on purpose --
 * blocking this worker thread is free, and it avoids bouncing libuv completions
 * off a busy main-thread event loop.
 */
export function writeOutput(rawSpan: RawSpan | undefined, payload: OutputWorkerPayload): Promise<WorkerJobResult<void>> {
  return workerJob(rawSpan, (span) => {
    const strategies = payload.strategies.map(reviveStrategy);

    span.traceChildSync('write to strategies', () => writeDataToStrategies(payload.data, strategies));

    const date = new Date(payload.dateMs);

    return span.traceChildAsync('output to disk', async (childSpan) => {
      // Sequential on purpose: the writes are synchronous, so there is nothing to
      // overlap, and this keeps the emitted trace in strategy order.
      for (let i = 0, len = strategies.length; i < len; i++) {
        const strategy = strategies[i];
        const filePath = resolveStrategyOutputPath(strategy, payload.id);

        // eslint-disable-next-line no-await-in-loop -- see above
        await childSpan.traceChildAsync(
          'write ' + strategy.name,
          (strategySpan) => strategy.outputInWorker(strategySpan, payload.title, payload.description, date, filePath)
        );
      }
    });
  });
}
