import { describe, it } from 'mocha';
import { expect } from 'earl';
import { performance } from 'node:perf_hooks';

import { analyzeTraces } from './report';
import type { CategoryStat, TraceAnalysis } from './report';
import { SpanCategory, UNCATEGORIZED } from './types';
import type { TraceResult } from './types';

interface SpanExtra extends Partial<Pick<TraceResult, 'category' | 'thread' | 'sync' | 'timeOrigin'>> {
  /** cumulative loop idle (ms) at start and end; defaults to "loop never idle" */
  idle?: [atStart: number, atEnd: number]
}

function span(name: string, start: number, end: number, extra: SpanExtra = {}, children: TraceResult[] = []): TraceResult {
  const { idle, ...rest } = extra;
  return {
    name,
    start,
    end,
    thread: 0,
    children,
    loopIdle: { atStart: idle?.[0] ?? 0, atEnd: idle?.[1] ?? 0 },
    ...rest
  };
}

function indexByCategory(analysis: TraceAnalysis) {
  return analysis.categories.reduce<Record<string, CategoryStat>>((acc, c) => {
    acc[c.category] = c;
    return acc;
  }, {});
}

function mainThread(analysis: TraceAnalysis) {
  return analysis.threads.find(t => t.thread === 0)!;
}

describe('trace report analysis', () => {
  it('hands every instant of a thread out exactly once, so category totals add up to wall', () => {
    // Two concurrent downloads (10-50, 30-70) and a sync compute (80-90) under one
    // task. The loop idled 40ms in total, all of it while the downloads were in flight.
    const task = span('task', 0, 100, { idle: [0, 40] }, [
      span('a', 10, 50, { category: SpanCategory.Network, idle: [0, 20] }),
      span('b', 30, 70, { category: SpanCategory.Network, idle: [10, 40] }),
      span('c', 80, 90, { category: SpanCategory.Compute, sync: true, idle: [40, 40] })
    ]);

    const analysis = analyzeTraces([task]);
    const main = mainThread(analysis);
    const byCategory = indexByCategory(analysis);

    expect(analysis.wall).toEqual(100);
    expect(main.attributed.cpu + main.attributed.wait).toEqual(100);
    expect(main.attributed.wait).toEqual(40);

    // downloads were innermost for 60ms of wall (not 80ms: the overlap is shared, not doubled)
    const network = byCategory[SpanCategory.Network].main;
    expect(network.cpu + network.wait).toEqual(60);
    expect(network.wait).toEqual(40);
    expect(byCategory[SpanCategory.Network].coverage).toEqual(60);

    expect(byCategory[SpanCategory.Compute].main).toEqual({ cpu: 10, wait: 0 });
    // the task itself is innermost for 0-10, 70-80 and 90-100
    expect(byCategory[UNCATEGORIZED].main).toEqual({ cpu: 30, wait: 0 });

    // the equal split: 30-50 is shared by a and b, 10-30 is a's alone, 50-70 is b's alone
    expect(analysis.attribution.get(task.children[0])!.cpu + analysis.attribution.get(task.children[0])!.wait).toEqual(30);
    expect(analysis.attribution.get(task.children[1])!.cpu + analysis.attribution.get(task.children[1])!.wait).toEqual(30);
  });

  it('gives a synchronous span the whole segment even when async spans are in flight', () => {
    const task = span('task', 0, 100, {}, [
      span('download', 0, 100, { category: SpanCategory.Network }),
      span('parse', 40, 60, { category: SpanCategory.Compute, sync: true })
    ]);

    const analysis = analyzeTraces([task]);
    const byCategory = indexByCategory(analysis);

    expect(byCategory[SpanCategory.Compute].main).toEqual({ cpu: 20, wait: 0 });
    expect(byCategory[SpanCategory.Network].main).toEqual({ cpu: 80, wait: 0 });
    expect(byCategory[UNCATEGORIZED].main).toEqual({ cpu: 0, wait: 0 });
  });

  it('reports time with no span in flight as untraced', () => {
    const analysis = analyzeTraces([
      span('first', 0, 10),
      span('second', 30, 40)
    ]);

    expect(mainThread(analysis).untraced).toEqual({ cpu: 20, wait: 0 });
    expect(analysis.wall).toEqual(40);
  });

  it('skips unfinished spans but counts them', () => {
    const task = span('task', 0, 10, {}, [span('never stopped', 5, 0)]);

    const analysis = analyzeTraces([task]);

    expect(analysis.unfinishedSpans).toEqual(1);
    // the unfinished child does not steal the parent's time
    expect(indexByCategory(analysis)[UNCATEGORIZED].main).toEqual({ cpu: 10, wait: 0 });
  });

  it('sweeps each thread on its own and keeps the main thread waiting on the worker', () => {
    const task = span('task', 0, 100, { idle: [0, 100] }, [
      span('offload', 0, 100, { category: SpanCategory.Worker, idle: [0, 100] }, [
        span('crunch', 20, 60, { category: SpanCategory.Compute, thread: 7, sync: true })
      ])
    ]);

    const analysis = analyzeTraces([task]);
    const byCategory = indexByCategory(analysis);

    // the child runs on another thread, so `offload` stays innermost on main for its full 100ms
    expect(byCategory[SpanCategory.Worker].main).toEqual({ cpu: 0, wait: 100 });
    expect(byCategory[SpanCategory.Compute].workers).toEqual({ cpu: 40, wait: 0 });
    expect(byCategory[SpanCategory.Compute].main).toEqual({ cpu: 0, wait: 0 });
    expect(analysis.threads.map(t => t.thread)).toEqual([0, 7]);
  });

  it('shifts a trace produced on another thread onto the local clock', () => {
    // A worker whose clock started 1000ms after ours reports everything 1000ms early
    const workerTask = span('worker task', 0, 10, { thread: 7, timeOrigin: performance.timeOrigin + 1000 });
    const mainTask = span('main task', 1000, 1010);

    const analysis = analyzeTraces([workerTask, mainTask]);

    expect(analysis.wallStart).toEqual(1000);
    expect(analysis.wallEnd).toEqual(1010);
    expect(analysis.tasks[0].node.start).toEqual(1000);
    // attribution is keyed by the shifted copy
    expect(analysis.attribution.get(analysis.traces[0])).toEqual({ cpu: 10, wait: 0 });
  });
});
