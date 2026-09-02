import { performance } from 'node:perf_hooks';
import { stripVTControlCharacters } from 'node:util';
import picocolors from 'picocolors';
import { SpanCategory, UNCATEGORIZED } from './types';
import type { ReportedSpanCategory, SpanEventLoopUtilization, TraceResult } from './types';

/** Fixed display order: I/O flavours first, then compute, then the "waiting on something else" buckets */
const CATEGORY_ORDER: ReportedSpanCategory[] = [
  SpanCategory.Network,
  SpanCategory.FsRead,
  SpanCategory.FsWrite,
  SpanCategory.Compute,
  SpanCategory.Worker,
  SpanCategory.Wait,
  UNCATEGORIZED
];

const CATEGORY_COLOR: Record<ReportedSpanCategory, (s: string) => string> = {
  [SpanCategory.Network]: picocolors.cyan,
  [SpanCategory.FsRead]: picocolors.green,
  [SpanCategory.FsWrite]: picocolors.yellow,
  [SpanCategory.Compute]: picocolors.magenta,
  [SpanCategory.Worker]: picocolors.blue,
  [SpanCategory.Wait]: picocolors.gray,
  [UNCATEGORIZED]: picocolors.gray
};

const TOP_SPANS_PER_CATEGORY = 5;
const TOP_SPANS_OVERALL = 15;

// ---------------------------------------------------------------------------
// Clock alignment
// ---------------------------------------------------------------------------

export function adjustTraceTimestamps(trace: TraceResult, offset: number): TraceResult {
  const adjusted: TraceResult = {
    ...trace,
    start: trace.start + offset,
    end: trace.end + offset,
    children: trace.children.map(child => adjustTraceTimestamps(child, offset))
  };
  // the clock is now the main thread's, so the marker no longer applies
  delete adjusted.timeOrigin;
  return adjusted;
}

/**
 * A task that ran on a worker thread reports `performance.now()` values relative
 * to that thread's own `timeOrigin`. Shift them onto the current thread's clock
 * so tasks can be laid out on a shared timeline.
 */
export function normalizeTraceClock(trace: TraceResult): TraceResult {
  if (trace.timeOrigin == null || trace.timeOrigin === performance.timeOrigin) {
    return trace;
  }
  return adjustTraceTimestamps(trace, trace.timeOrigin - performance.timeOrigin);
}

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------

/** Wall-clock attributed to something, split by what the event loop was doing meanwhile */
export interface Attribution {
  /** loop was busy: CPU on that thread */
  cpu: number,
  /** loop was idle: waiting on I/O, a timer, another thread... */
  wait: number
}

export interface AnalyzedSpan {
  node: TraceResult,
  /** Ancestor names, root task first, this span last */
  path: string[],
  category: ReportedSpanCategory,
  duration: number,
  /** Wall-clock attributed to this span (i.e. while it was innermost in flight on its thread) */
  attributed: Attribution
}

export interface CategoryStat {
  category: ReportedSpanCategory,
  spans: number,
  /** Wall-clock during which at least one span of this category was in flight, on any thread */
  coverage: number,
  /** Attributed time on the main thread -- the one whose wall-clock is the build's */
  main: Attribution,
  /** Attributed time on worker threads, which run in parallel to the main thread */
  workers: Attribution,
  top: AnalyzedSpan[]
}

export interface TaskStat {
  node: TraceResult,
  duration: number,
  attributed: Attribution,
  byCategory: Record<ReportedSpanCategory, Attribution>
}

export interface ThreadStat {
  thread: number,
  /** wall-clock from the first to the last span event on this thread */
  span: number,
  attributed: Attribution,
  /** time between span events with no span in flight on this thread */
  untraced: Attribution,
  byCategory: Record<ReportedSpanCategory, Attribution>
}

export interface TraceAnalysis {
  /** the input traces, shifted onto the local clock; `attribution` is keyed by these nodes */
  traces: TraceResult[],
  wallStart: number,
  wallEnd: number,
  wall: number,
  /** thread 0 first, then workers by id */
  threads: ThreadStat[],
  categories: CategoryStat[],
  tasks: TaskStat[],
  topSpans: AnalyzedSpan[],
  /** per node, so the tree printer can annotate without recomputing */
  attribution: Map<TraceResult, Attribution>,
  unfinishedSpans: number
}

type Interval = [start: number, end: number];

function isFinished(node: TraceResult) {
  return node.end >= node.start;
}

function zeroAttribution(): Attribution {
  return { cpu: 0, wait: 0 };
}

function attributionTotal(a: Attribution) {
  return a.cpu + a.wait;
}

function emptyByCategory(): Record<ReportedSpanCategory, Attribution> {
  return {
    [SpanCategory.Network]: zeroAttribution(),
    [SpanCategory.FsRead]: zeroAttribution(),
    [SpanCategory.FsWrite]: zeroAttribution(),
    [SpanCategory.Compute]: zeroAttribution(),
    [SpanCategory.Worker]: zeroAttribution(),
    [SpanCategory.Wait]: zeroAttribution(),
    [UNCATEGORIZED]: zeroAttribution()
  };
}

/** Total length covered by the union of the intervals (handles overlap, which async children routinely do) */
function unionLength(intervals: Interval[]): number {
  if (intervals.length === 0) {
    return 0;
  }
  intervals.sort((a, b) => a[0] - b[0]);

  let total = 0;
  let [curStart, curEnd] = intervals[0];
  for (let i = 1, len = intervals.length; i < len; i++) {
    const [start, end] = intervals[i];
    if (start <= curEnd) {
      if (end > curEnd) {
        curEnd = end;
      }
    } else {
      total += curEnd - curStart;
      curStart = start;
      curEnd = end;
    }
  }
  return total + (curEnd - curStart);
}

interface SpanRecord {
  node: TraceResult,
  parent: SpanRecord | null,
  task: TaskStat,
  category: ReportedSpanCategory,
  path: string[],
  /** number of in-flight children on the same thread; the span is "innermost" while this is 0 */
  activeChildren: number
}

interface SpanEvent {
  time: number,
  /** cumulative loop idle of the thread at this moment */
  idle: number,
  record: SpanRecord,
  isStart: boolean
}

/**
 * Sweep one thread's span events and attribute every segment between two
 * consecutive events to the spans that were innermost in flight at that time:
 *
 * - the loop-idle delta of the segment is time spent waiting, the rest is CPU;
 * - if a synchronous span is innermost it owns the whole segment (nothing else
 *   can run on the thread meanwhile);
 * - otherwise the segment is split equally among the innermost async spans;
 * - a segment with nothing in flight is "untraced".
 *
 * Because every instant of the thread's timeline is handed out exactly once,
 * the per-category totals add up to the thread's wall-clock -- unlike summing
 * span durations, which counts a queued span's wait once per queued span.
 */
function sweepThread(events: SpanEvent[], threadStat: ThreadStat, attribution: Map<TraceResult, Attribution>) {
  // ends before starts at equal timestamps, so a back-to-back sibling pair never overlaps
  events.sort((a, b) => a.time - b.time || (a.isStart ? 1 : 0) - (b.isStart ? 1 : 0));

  const inFlight = new Set<SpanRecord>();
  const innermost: SpanRecord[] = [];

  const attribute = (record: SpanRecord | null, cpu: number, wait: number) => {
    threadStat.attributed.cpu += cpu;
    threadStat.attributed.wait += wait;

    if (record === null) {
      threadStat.untraced.cpu += cpu;
      threadStat.untraced.wait += wait;
      return;
    }

    const own = attribution.get(record.node);
    if (own) {
      own.cpu += cpu;
      own.wait += wait;
    } else {
      attribution.set(record.node, { cpu, wait });
    }

    const taskBucket = record.task.byCategory[record.category];
    taskBucket.cpu += cpu;
    taskBucket.wait += wait;
    record.task.attributed.cpu += cpu;
    record.task.attributed.wait += wait;

    const threadBucket = threadStat.byCategory[record.category];
    threadBucket.cpu += cpu;
    threadBucket.wait += wait;
  };

  for (let i = 0, len = events.length; i < len; i++) {
    const event = events[i];

    if (i > 0) {
      const prev = events[i - 1];
      const duration = event.time - prev.time;
      if (duration > 0) {
        // the idle counter is only advanced when the loop leaves poll, so a
        // segment inside one synchronous tick correctly reads as all-cpu
        const wait = Math.min(duration, Math.max(0, event.idle - prev.idle));
        const cpu = duration - wait;

        innermost.length = 0;
        let sync: SpanRecord | null = null;
        for (const record of inFlight) {
          if (record.activeChildren === 0) {
            innermost.push(record);
            if (record.node.sync) {
              sync = record;
            }
          }
        }

        if (sync) {
          attribute(sync, cpu, wait);
        } else if (innermost.length === 0) {
          attribute(null, cpu, wait);
        } else {
          const share = 1 / innermost.length;
          for (let j = 0, jlen = innermost.length; j < jlen; j++) {
            attribute(innermost[j], cpu * share, wait * share);
          }
        }
      }
    }

    const { record } = event;
    const sameThreadParent = record.parent?.node.thread === record.node.thread ? record.parent : null;
    if (event.isStart) {
      inFlight.add(record);
      if (sameThreadParent) {
        sameThreadParent.activeChildren++;
      }
    } else {
      inFlight.delete(record);
      if (sameThreadParent) {
        sameThreadParent.activeChildren--;
      }
    }
  }

  if (events.length > 0) {
    threadStat.span = events.at(-1)!.time - events[0].time;
  }
}

export function analyzeTraces(rawTraces: TraceResult[]): TraceAnalysis {
  const traces = rawTraces.map(normalizeTraceClock);

  const records: SpanRecord[] = [];
  const eventsByThread = new Map<number, SpanEvent[]>();
  const coverageIntervals = new Map<ReportedSpanCategory, Interval[]>();
  const spanCount = new Map<ReportedSpanCategory, number>();
  for (let i = 0, len = CATEGORY_ORDER.length; i < len; i++) {
    coverageIntervals.set(CATEGORY_ORDER[i], []);
    spanCount.set(CATEGORY_ORDER[i], 0);
  }

  let unfinishedSpans = 0;
  let wallStart = Infinity;
  let wallEnd = -Infinity;

  const walk = (node: TraceResult, parent: SpanRecord | null, task: TaskStat) => {
    const path = parent ? parent.path.concat(node.name) : [node.name];
    const category = node.category ?? UNCATEGORIZED;
    const record: SpanRecord = { node, parent, task, category, path, activeChildren: 0 };

    if (isFinished(node)) {
      records.push(record);
      spanCount.set(category, spanCount.get(category)! + 1);
      coverageIntervals.get(category)!.push([node.start, node.end]);
      if (node.start < wallStart) wallStart = node.start;
      if (node.end > wallEnd) wallEnd = node.end;

      let events = eventsByThread.get(node.thread);
      if (!events) {
        events = [];
        eventsByThread.set(node.thread, events);
      }
      // a span without loop samples (a hand-built trace) reads as all-cpu
      events.push(
        { time: node.start, idle: node.loopIdle?.atStart ?? 0, record, isStart: true },
        { time: node.end, idle: node.loopIdle?.atEnd ?? 0, record, isStart: false }
      );
    } else {
      unfinishedSpans++;
    }

    for (let i = 0, len = node.children.length; i < len; i++) {
      walk(node.children[i], record, task);
    }
  };

  const tasks: TaskStat[] = traces.map((trace) => {
    const task: TaskStat = {
      node: trace,
      duration: isFinished(trace) ? trace.end - trace.start : 0,
      attributed: zeroAttribution(),
      byCategory: emptyByCategory()
    };
    walk(trace, null, task);
    return task;
  });

  const attribution = new Map<TraceResult, Attribution>();
  const threads: ThreadStat[] = Array.from(eventsByThread.keys())
    .sort((a, b) => a - b)
    .map((thread) => {
      const threadStat: ThreadStat = {
        thread,
        span: 0,
        attributed: zeroAttribution(),
        untraced: zeroAttribution(),
        byCategory: emptyByCategory()
      };
      sweepThread(eventsByThread.get(thread)!, threadStat, attribution);
      return threadStat;
    });

  const spans: AnalyzedSpan[] = records.map(record => ({
    node: record.node,
    path: record.path,
    category: record.category,
    duration: record.node.end - record.node.start,
    attributed: attribution.get(record.node) ?? zeroAttribution()
  }));
  spans.sort((a, b) => attributionTotal(b.attributed) - attributionTotal(a.attributed));

  const categories: CategoryStat[] = CATEGORY_ORDER.map((category) => {
    const main = zeroAttribution();
    const workers = zeroAttribution();
    for (let i = 0, len = threads.length; i < len; i++) {
      const source = threads[i].byCategory[category];
      const target = threads[i].thread === 0 ? main : workers;
      target.cpu += source.cpu;
      target.wait += source.wait;
    }
    return {
      category,
      spans: spanCount.get(category)!,
      coverage: unionLength(coverageIntervals.get(category)!),
      main,
      workers,
      top: spans.filter(s => s.category === category && attributionTotal(s.attributed) > 0).slice(0, TOP_SPANS_PER_CATEGORY)
    };
  });

  return {
    traces,
    wallStart,
    wallEnd,
    wall: wallEnd > wallStart ? wallEnd - wallStart : 0,
    threads,
    categories,
    tasks,
    topSpans: spans.filter(s => attributionTotal(s.attributed) > 0).slice(0, TOP_SPANS_OVERALL),
    attribution,
    unfinishedSpans
  };
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function fmtMs(ms: number): string {
  if (ms >= 10000) {
    return `${(ms / 1000).toFixed(2)}s`;
  }
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(3)}s`;
  }
  return `${ms.toFixed(1)}ms`;
}

function fmtPercent(part: number, whole: number): string {
  if (whole <= 0) {
    return 'n/a';
  }
  return `${(part / whole * 100).toFixed(0)}%`;
}

function fmtAttribution(a: Attribution): string {
  return `cpu=${fmtMs(a.cpu)} wait=${fmtMs(a.wait)}`;
}

function categoryTag(category: ReportedSpanCategory): string {
  return CATEGORY_COLOR[category](`[${category}]`);
}

function threadLabel(thread: number): string {
  return thread === 0 ? 'main' : `worker#${thread}`;
}

/**
 * Collapse the middle of a breadcrumb so both ends survive: the task it belongs
 * to and the span itself (plus as many of its nearest ancestors as fit).
 */
function fmtPath(path: string[], maxLength: number): string {
  if (path.length < 3) {
    return path.join(' › ');
  }
  const head = path[0];
  let out = path.at(-1)!;
  for (let i = path.length - 2; i >= 1; i--) {
    const candidate = `${path[i]} › ${out}`;
    if (head.length + candidate.length + 8 > maxLength) {
      return `${head} › … › ${out}`;
    }
    out = candidate;
  }
  return `${head} › ${out}`;
}

/** Printable width of a string that may carry picocolors escapes */
function visibleLength(s: string): number {
  return stripVTControlCharacters(s).length;
}

function pad(s: string, width: number, alignRight: boolean): string {
  const fill = ' '.repeat(Math.max(0, width - visibleLength(s)));
  return alignRight ? fill + s : s + fill;
}

/** Columns in [rightAlignFrom, rightAlignTo) are numeric and right-aligned, the rest left-aligned */
function table(header: string[], rows: string[][], rightAlignFrom = 1, rightAlignTo = Infinity): string[] {
  const widths = header.map((h, col) => Math.max(visibleLength(h), ...rows.map(r => visibleLength(r[col]))));
  const fmtRow = (row: string[]) => row
    .map((cell, col) => pad(cell, widths[col], col >= rightAlignFrom && col < rightAlignTo))
    .join('  ')
    .trimEnd();
  return [
    picocolors.bold(fmtRow(header)),
    picocolors.dim(widths.map(w => '─'.repeat(w)).join('  ')),
    ...rows.map(fmtRow)
  ];
}

function dotIfZero(value: number): string {
  return value > 0 ? fmtMs(value) : picocolors.dim('·');
}

function fmtCpuWait(a: Attribution): string {
  return attributionTotal(a) > 0 ? `${fmtMs(a.cpu)}/${fmtMs(a.wait)}` : picocolors.dim('·');
}

// ---------------------------------------------------------------------------
// Printing
// ---------------------------------------------------------------------------

export function printTraceResult(traceResult: TraceResult, analysis: TraceAnalysis = analyzeTraces([traceResult])) {
  const { attribution } = analysis;
  printTree(
    analysis.traces.find(t => t === traceResult) ?? normalizeTraceClock(traceResult),
    (node, parentThread) => {
      const parts: string[] = [node.name];

      if (node.category) {
        parts.push(categoryTag(node.category));
      }

      if (!isFinished(node)) {
        parts.push(picocolors.red('(unfinished)'));
        return parts.join(' ');
      }

      parts.push(picocolors.bold(fmtMs(node.end - node.start)));

      // a sync span is trivially all-cpu for its whole duration
      const own = attribution.get(node);
      if (own && !node.sync && attributionTotal(own) >= 0.1) {
        parts.push(picocolors.dim(`self(${fmtAttribution(own)})`));
      }

      if (node.thread !== parentThread) {
        parts.push(picocolors.dim(`@${threadLabel(node.thread)}`));
      }

      return parts.join(' ');
    }
  );
}

function printTree(initialTree: TraceResult, printNode: (node: TraceResult, parentThread: number) => string) {
  function printBranch(tree: TraceResult, branch: string, isGraphHead: boolean, isChildOfLastBranch: boolean, parentThread: number) {
    const children = tree.children;

    let branchHead = '';

    if (!isGraphHead) {
      branchHead = children.length > 0 ? '┬ ' : '─ ';
    }

    console.log(`${branch}${branchHead}${printNode(tree, parentThread)}`);

    let baseBranch = branch;

    if (!isGraphHead) {
      baseBranch = branch.slice(0, -2) + (isChildOfLastBranch ? '  ' : '│ ');
    }

    const nextBranch = `${baseBranch}├─`;
    const lastBranch = `${baseBranch}└─`;

    children.forEach((child, index) => {
      const last = children.length - 1 === index;
      printBranch(child, last ? lastBranch : nextBranch, false, last, tree.thread);
    });
  }

  printBranch(initialTree, '', true, false, initialTree.thread);
}

/** Gantt-style overview of the top-level tasks on a shared timeline */
export function printStats(rawStats: TraceResult[]): void {
  const stats = rawStats.reduce<TraceResult[]>((acc, trace) => {
    const normalized = normalizeTraceClock(trace);
    if (isFinished(normalized)) {
      acc.push(normalized);
    }
    return acc;
  }, []);
  if (stats.length === 0) {
    return;
  }

  const longestTaskName = Math.max(...stats.map(i => i.name.length));
  const realStart = Math.min(...stats.map(i => i.start));
  const realEnd = Math.max(...stats.map(i => i.end));

  const width = 100;
  const statsStep = Math.max((realEnd - realStart) / width, 1);

  console.log(picocolors.bold('[timeline]'), `${fmtMs(realEnd - realStart)} wall, one column ≈ ${fmtMs(statsStep)}`);

  stats
    .sort((a, b) => a.start - b.start)
    .forEach((stat) => {
      const offset = ((stat.start - realStart) / statsStep) | 0;
      const length = Math.max(((stat.end - stat.start) / statsStep) | 0, 1);
      console.log(
        `[${stat.name}]${' '.repeat(longestTaskName - stat.name.length)}`,
        ' '.repeat(offset) + '='.repeat(length),
        picocolors.dim(fmtMs(stat.end - stat.start) + (stat.thread === 0 ? '' : ` @${threadLabel(stat.thread)}`))
      );
    });
}

export interface BuildResourceUsage {
  /** Main thread event loop utilization delta over the whole build */
  elu?: SpanEventLoopUtilization,
  /** `process.cpuUsage()` delta over the whole build, in microseconds. Covers every thread */
  cpu?: NodeJS.CpuUsage
}

function printOverview(analysis: TraceAnalysis, usage: BuildResourceUsage | undefined) {
  const parts = [`wall=${fmtMs(analysis.wall)}`];

  if (usage?.elu) {
    const { active, idle } = usage.elu;
    parts.push(`main-loop-busy=${fmtMs(active)} (${fmtPercent(active, active + idle)})`, `main-loop-idle=${fmtMs(idle)}`);
  }
  if (usage?.cpu) {
    const user = usage.cpu.user / 1000;
    const system = usage.cpu.system / 1000;
    const total = user + system;
    parts.push(
      `process-cpu=${fmtMs(total)} (user ${fmtMs(user)} / sys ${fmtMs(system)})`,
      analysis.wall > 0 ? `cpu/wall=${(total / analysis.wall).toFixed(2)}x` : ''
    );
  }
  if (analysis.unfinishedSpans > 0) {
    parts.push(picocolors.red(`unfinished-spans=${analysis.unfinishedSpans}`));
  }

  console.log(picocolors.bold('[build]'), parts.filter(Boolean).join(' '));
}

function printMainThreadBreakdown(analysis: TraceAnalysis) {
  const main = analysis.threads.find(t => t.thread === 0);
  if (!main) {
    return;
  }

  const total = attributionTotal(main.attributed);

  console.log();
  console.log(
    picocolors.bold('[main thread: where did the wall-clock go]'),
    `${fmtMs(total)} = cpu ${fmtMs(main.attributed.cpu)} (${fmtPercent(main.attributed.cpu, total)}) + wait ${fmtMs(main.attributed.wait)} (${fmtPercent(main.attributed.wait, total)})`
  );
  console.log(picocolors.dim(
    '  every instant is handed to the innermost spans in flight on the main thread (a synchronous span takes all\n'
    + '  of it, async spans split it equally), and classified as cpu (event loop busy) or wait (event loop idle);\n'
    + '  coverage = wall-clock during which at least one span of that category was in flight, on any thread'
  ));

  const rows = analysis.categories.reduce<string[][]>((acc, c) => {
    if (c.spans > 0) {
      const t = attributionTotal(c.main);
      acc.push([
        CATEGORY_COLOR[c.category](c.category),
        fmtMs(t),
        fmtPercent(t, total),
        dotIfZero(c.main.cpu),
        dotIfZero(c.main.wait),
        fmtMs(c.coverage),
        String(c.spans)
      ]);
    }
    return acc;
  }, []);
  const untraced = attributionTotal(main.untraced);
  if (untraced > 0) {
    rows.push([
      picocolors.dim('(no span in flight)'),
      fmtMs(untraced),
      fmtPercent(untraced, total),
      dotIfZero(main.untraced.cpu),
      dotIfZero(main.untraced.wait),
      picocolors.dim('·'),
      picocolors.dim('·')
    ]);
  }

  table(['category', 'total', 'share', 'cpu', 'wait', 'coverage', 'spans'], rows)
    .forEach(line => console.log('  ' + line));
}

function printWorkerThreads(analysis: TraceAnalysis) {
  const workers = analysis.threads.filter(t => t.thread !== 0);
  if (workers.length === 0) {
    return;
  }

  console.log();
  console.log(picocolors.bold('[worker threads]'), picocolors.dim('(run in parallel to the main thread; same attribution, per thread; cpu / wait)'));

  const rows = workers.map((t) => {
    const byCategory = CATEGORY_ORDER.reduce<string[]>((acc, category) => {
      const a = t.byCategory[category];
      if (attributionTotal(a) > 0) {
        acc.push(`${CATEGORY_COLOR[category](category)} ${fmtCpuWait(a)}`);
      }
      return acc;
    }, []);
    return [
      threadLabel(t.thread),
      fmtMs(t.span),
      fmtMs(t.attributed.cpu),
      fmtMs(t.attributed.wait),
      byCategory.join(', ')
    ];
  });

  table(['thread', 'active for', 'cpu', 'wait', 'by category'], rows, 1, 4)
    .forEach(line => console.log('  ' + line));
}

function printTopSpans(analysis: TraceAnalysis) {
  const describe = (span: AnalyzedSpan) => {
    const extra: string[] = [span.node.sync ? 'sync' : fmtAttribution(span.attributed)];
    // only worth showing when it differs from what was attributed (children or concurrency)
    if (attributionTotal(span.attributed) < span.duration * 0.98) {
      extra.push(`wall=${fmtMs(span.duration)}`);
    }
    if (span.node.thread !== 0) {
      extra.push(`@${threadLabel(span.node.thread)}`);
    }
    return picocolors.dim(extra.join(' '));
  };

  console.log();
  console.log(picocolors.bold('[top spans by attributed time, per category]'));
  for (let i = 0, len = analysis.categories.length; i < len; i++) {
    const stat = analysis.categories[i];
    if (stat.top.length === 0) {
      continue;
    }
    console.log('  ' + categoryTag(stat.category));
    for (let j = 0, jlen = stat.top.length; j < jlen; j++) {
      const span = stat.top[j];
      console.log(
        '    ',
        picocolors.bold(fmtMs(attributionTotal(span.attributed)).padStart(9)),
        fmtPath(span.path, 110),
        describe(span)
      );
    }
  }

  console.log();
  console.log(picocolors.bold('[top spans by attributed time, overall]'));
  for (let i = 0, len = analysis.topSpans.length; i < len; i++) {
    const span = analysis.topSpans[i];
    console.log(
      '    ',
      picocolors.bold(fmtMs(attributionTotal(span.attributed)).padStart(9)),
      pad(categoryTag(span.category), 15, false),
      fmtPath(span.path, 100),
      describe(span)
    );
  }
}

function printTaskMatrix(analysis: TraceAnalysis) {
  if (analysis.tasks.length === 0) {
    return;
  }

  console.log();
  console.log(
    picocolors.bold('[time by task × category]'),
    picocolors.dim('(wall-clock attributed to the task\'s spans, on whichever thread they ran; cpu / wait)')
  );

  const usedCategories = CATEGORY_ORDER.filter(c => analysis.tasks.some(t => attributionTotal(t.byCategory[c]) > 0));

  const rows = analysis.tasks
    .toSorted((a, b) => b.duration - a.duration)
    .map(task => [
      task.node.name + (task.node.thread === 0 ? '' : picocolors.dim(` @${threadLabel(task.node.thread)}`)),
      fmtMs(task.duration),
      dotIfZero(task.attributed.cpu),
      dotIfZero(task.attributed.wait),
      ...usedCategories.map(c => fmtCpuWait(task.byCategory[c]))
    ]);

  table(['task', 'wall', 'cpu', 'wait', ...usedCategories], rows)
    .forEach(line => console.log('  ' + line));
}

/**
 * The full post-build report: every task's span tree, then the aggregate views
 * (where does time go by category, which spans dominate, per-task breakdown and
 * the shared timeline).
 */
export function printBuildReport(traces: TraceResult[], usage?: BuildResourceUsage) {
  const analysis = analyzeTraces(traces);

  analysis.traces.forEach(trace => printTraceResult(trace, analysis));

  console.log();
  printOverview(analysis, usage);
  printMainThreadBreakdown(analysis);
  printWorkerThreads(analysis);
  printTopSpans(analysis);
  printTaskMatrix(analysis);
  console.log();
  printStats(traces);
}
