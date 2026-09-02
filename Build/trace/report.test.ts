import { describe, it } from 'mocha';
import { expect } from 'earl';
import { performance } from 'node:perf_hooks';

import { analyzeTraces } from './report';
import { SpanCategory, UNCATEGORIZED } from './types';
import type { TraceResult } from './types';
import type { CategoryStat, TraceAnalysis } from './report';

function span(
  name: string,
  start: number,
  end: number,
  extra: Partial<Pick<TraceResult, 'category' | 'thread' | 'sync' | 'timeOrigin'>> = {},
  children: TraceResult[] = []
): TraceResult {
  return { name, start, end, thread: 0, children, ...extra };
}

function indexByCategory(analysis: TraceAnalysis) {
  return analysis.categories.reduce<Record<string, CategoryStat>>((acc, c) => {
    acc[c.category] = c;
    return acc;
  }, {});
}

describe('trace report analysis', () => {
  it('attributes self time as duration minus the union of (overlapping) children', () => {
    const task = span('task', 0, 100, {}, [
      // two async children that overlap: 10-50 and 30-70 cover 60ms, not 80ms
      span('a', 10, 50, { category: SpanCategory.Network }),
      span('b', 30, 70, { category: SpanCategory.Network }),
      span('c', 80, 90, { category: SpanCategory.Compute, sync: true })
    ]);

    const analysis = analyzeTraces([task]);
    const byCategory = indexByCategory(analysis);

    expect(analysis.wall).toEqual(100);
    expect(byCategory[UNCATEGORIZED].selfTotal).toEqual(100 - 60 - 10);
    // self of leaves is their full duration, summed across the concurrent pair
    expect(byCategory[SpanCategory.Network].selfTotal).toEqual(40 + 40);
    // coverage de-duplicates the overlap
    expect(byCategory[SpanCategory.Network].coverage).toEqual(60);
    expect(byCategory[SpanCategory.Compute].selfTotal).toEqual(10);
    expect(byCategory[SpanCategory.Compute].selfSync).toEqual(10);
    expect(byCategory[SpanCategory.Network].selfSync).toEqual(0);

    expect(analysis.tasks[0].byCategory[SpanCategory.Network]).toEqual(80);
    expect(analysis.tasks[0].byCategory[UNCATEGORIZED]).toEqual(30);
  });

  it('clips children to the parent window and never reports negative self time', () => {
    // fire-and-forget child that outlives its parent
    const task = span('task', 0, 50, {}, [span('late', 40, 90, { category: SpanCategory.FsWrite })]);

    const analysis = analyzeTraces([task]);
    const byCategory = indexByCategory(analysis);

    expect(byCategory[UNCATEGORIZED].selfTotal).toEqual(40);
    expect(byCategory[SpanCategory.FsWrite].selfTotal).toEqual(50);
    expect(analysis.wall).toEqual(90);
  });

  it('skips unfinished spans but counts them', () => {
    const task = span('task', 0, 10, {}, [span('never stopped', 5, 0)]);

    const analysis = analyzeTraces([task]);

    expect(analysis.unfinishedSpans).toEqual(1);
    // the unfinished child does not eat into the parent's self time
    expect(analysis.categories.find(c => c.category === UNCATEGORIZED)!.selfTotal).toEqual(10);
  });

  it('splits self time between the main thread and workers', () => {
    const task = span('task', 0, 100, {}, [
      span('offload', 0, 100, { category: SpanCategory.Worker }, [
        span('crunch', 20, 60, { category: SpanCategory.Compute, thread: 7, sync: true })
      ])
    ]);

    const analysis = analyzeTraces([task]);
    const compute = analysis.categories.find(c => c.category === SpanCategory.Compute)!;
    const worker = analysis.categories.find(c => c.category === SpanCategory.Worker)!;

    expect(compute.selfOnWorkers).toEqual(40);
    expect(compute.selfOnMainThread).toEqual(0);
    expect(worker.selfOnMainThread).toEqual(60);
  });

  it('shifts a trace produced on another thread onto the local clock', () => {
    // A worker whose clock started 1000ms after ours reports everything 1000ms early
    const workerTask = span('worker task', 0, 10, { timeOrigin: performance.timeOrigin + 1000 });
    const mainTask = span('main task', 1000, 1010);

    const analysis = analyzeTraces([workerTask, mainTask]);

    expect(analysis.wallStart).toEqual(1000);
    expect(analysis.wallEnd).toEqual(1010);
    expect(analysis.tasks[0].node.start).toEqual(1000);
  });
});
