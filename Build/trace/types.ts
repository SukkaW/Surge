import type { EventLoopUtilization } from 'node:perf_hooks';

export const SPAN_STATUS_START = 0;
export const SPAN_STATUS_END = 1;

/**
 * What a span spends its *self* time on (its own duration minus whatever its
 * traced children cover). Unmarked spans are reported as "uncategorized" rather
 * than inheriting from their parent, so gaps in instrumentation stay visible.
 */
export enum SpanCategory {
  /** CPU-bound work on the current thread (parsing, trie ops, hashing, formatting) */
  Compute = 'compute',
  /** Reading from the local filesystem */
  FsRead = 'fs-read',
  /** Writing to the local filesystem */
  FsWrite = 'fs-write',
  /** Fetching from the network (download, DNS, HTTP HEAD, ...) */
  Network = 'network',
  /** Handing work to / waiting on a worker thread. Set automatically by traceWorkerChild */
  Worker = 'worker',
  /** Waiting on another in-flight promise that is traced (or untraced) elsewhere */
  Wait = 'wait'
}

export const UNCATEGORIZED = 'uncategorized';
export type ReportedSpanCategory = SpanCategory | typeof UNCATEGORIZED;

/** Delta of `performance.eventLoopUtilization()` across the span, in milliseconds */
export interface SpanEventLoopUtilization {
  idle: number,
  active: number
}

export interface TraceResult {
  name: string,
  category?: SpanCategory,
  start: number,
  end: number,
  /**
   * Event loop utilization of the thread that ran this span, over the span's
   * lifetime. `active` is an upper bound of this span's own CPU time: on a shared
   * event loop it also includes work done by concurrently running spans.
   */
  elu?: SpanEventLoopUtilization,
  /**
   * Set when the span wrapped a synchronous function: its whole self time is
   * CPU time on its thread, never queueing behind other work on the event loop.
   */
  sync?: true,
  /** `worker_threads.threadId` of the thread that created the span (0 = main thread) */
  thread: number,
  /**
   * `performance.timeOrigin` of the thread that produced this trace. Only set on
   * the root returned by a task so traces produced on a worker thread can be
   * shifted onto the main thread's clock before being compared with others.
   */
  timeOrigin?: number,
  children: TraceResult[]
}

/** Pure data object — safe to transfer across Worker Thread boundaries. */
export interface RawSpan {
  traceResult: TraceResult,
  status: typeof SPAN_STATUS_START | typeof SPAN_STATUS_END,
  /** `performance.eventLoopUtilization()` sampled when the span started */
  eluStart?: EventLoopUtilization
}
