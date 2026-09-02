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

export interface AnalyzedSpan {
  node: TraceResult,
  /** Ancestor names, root task first, this span last */
  path: string[],
  category: ReportedSpanCategory,
  duration: number,
  /** Duration not covered by any traced child */
  self: number
}

export interface CategoryStat {
  category: ReportedSpanCategory,
  /** Sum of self time of all spans with this category (across all threads, concurrency included) */
  selfTotal: number,
  /** Wall-clock during which at least one span of this category was in flight */
  coverage: number,
  spans: number,
  selfOnMainThread: number,
  selfOnWorkers: number,
  /** Self time of synchronous spans: guaranteed CPU, no event-loop queueing inside */
  selfSync: number,
  top: AnalyzedSpan[]
}

export interface TaskStat {
  node: TraceResult,
  duration: number,
  /** Self time of all descendants (and the task itself) bucketed by category */
  byCategory: Record<ReportedSpanCategory, number>
}

export interface TraceAnalysis {
  wallStart: number,
  wallEnd: number,
  wall: number,
  categories: CategoryStat[],
  tasks: TaskStat[],
  topSpans: AnalyzedSpan[],
  unfinishedSpans: number
}

type Interval = [start: number, end: number];

function isFinished(node: TraceResult) {
  return node.end >= node.start;
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

function selfTime(node: TraceResult): number {
  const duration = node.end - node.start;
  if (node.children.length === 0) {
    return duration;
  }

  const covered: Interval[] = [];
  for (let i = 0, len = node.children.length; i < len; i++) {
    const child = node.children[i];
    if (!isFinished(child)) {
      continue;
    }
    // clip to the parent's own window: a child stopped after its parent
    // (fire-and-forget) must not produce negative self time
    const start = Math.max(child.start, node.start);
    const end = Math.min(child.end, node.end);
    if (end > start) {
      covered.push([start, end]);
    }
  }

  return Math.max(0, duration - unionLength(covered));
}

function emptyByCategory(): Record<ReportedSpanCategory, number> {
  return {
    [SpanCategory.Network]: 0,
    [SpanCategory.FsRead]: 0,
    [SpanCategory.FsWrite]: 0,
    [SpanCategory.Compute]: 0,
    [SpanCategory.Worker]: 0,
    [SpanCategory.Wait]: 0,
    [UNCATEGORIZED]: 0
  };
}

export function analyzeTraces(rawTraces: TraceResult[]): TraceAnalysis {
  const traces = rawTraces.map(normalizeTraceClock);

  const spans: AnalyzedSpan[] = [];
  const coverageIntervals = new Map<ReportedSpanCategory, Interval[]>();
  const categoryStats = new Map<ReportedSpanCategory, CategoryStat>();
  for (let i = 0, len = CATEGORY_ORDER.length; i < len; i++) {
    const category = CATEGORY_ORDER[i];
    coverageIntervals.set(category, []);
    categoryStats.set(category, {
      category,
      selfTotal: 0,
      coverage: 0,
      spans: 0,
      selfOnMainThread: 0,
      selfOnWorkers: 0,
      selfSync: 0,
      top: []
    });
  }

  let unfinishedSpans = 0;
  let wallStart = Infinity;
  let wallEnd = -Infinity;

  const walk = (node: TraceResult, path: string[], task: TaskStat) => {
    const ownPath = path.concat(node.name);

    if (isFinished(node)) {
      const category = node.category ?? UNCATEGORIZED;
      const self = selfTime(node);
      spans.push({ node, path: ownPath, category, duration: node.end - node.start, self });

      const stat = categoryStats.get(category)!;
      stat.selfTotal += self;
      stat.spans++;
      if (node.thread === 0) {
        stat.selfOnMainThread += self;
      } else {
        stat.selfOnWorkers += self;
      }
      if (node.sync) {
        stat.selfSync += self;
      }
      coverageIntervals.get(category)!.push([node.start, node.end]);
      task.byCategory[category] += self;

      if (node.start < wallStart) wallStart = node.start;
      if (node.end > wallEnd) wallEnd = node.end;
    } else {
      unfinishedSpans++;
    }

    for (let i = 0, len = node.children.length; i < len; i++) {
      walk(node.children[i], ownPath, task);
    }
  };

  const tasks: TaskStat[] = traces.map((trace) => {
    const task: TaskStat = {
      node: trace,
      duration: isFinished(trace) ? trace.end - trace.start : 0,
      byCategory: emptyByCategory()
    };
    walk(trace, [], task);
    return task;
  });

  spans.sort((a, b) => b.self - a.self);

  const categories = CATEGORY_ORDER.map((category) => {
    const stat = categoryStats.get(category)!;
    stat.coverage = unionLength(coverageIntervals.get(category)!);
    stat.top = spans.filter(s => s.category === category && s.self > 0).slice(0, TOP_SPANS_PER_CATEGORY);
    return stat;
  });

  return {
    wallStart,
    wallEnd,
    wall: wallEnd > wallStart ? wallEnd - wallStart : 0,
    categories,
    tasks,
    topSpans: spans.filter(s => s.self > 0).slice(0, TOP_SPANS_OVERALL),
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

function categoryTag(category: ReportedSpanCategory): string {
  return CATEGORY_COLOR[category](`[${category}]`);
}

function loopBusy(node: TraceResult): string | null {
  const { elu } = node;
  // a sync span never yields to the loop, so the number would be a trivial 100%
  if (!elu || node.sync) {
    return null;
  }
  const total = elu.idle + elu.active;
  if (total < 1) {
    return null;
  }
  return `loop-busy=${fmtPercent(elu.active, total)}`;
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

function table(header: string[], rows: string[][], rightAlignFrom = 1): string[] {
  const widths = header.map((h, col) => Math.max(visibleLength(h), ...rows.map(r => visibleLength(r[col]))));
  const fmtRow = (row: string[]) => row
    .map((cell, col) => pad(cell, widths[col], col >= rightAlignFrom))
    .join('  ');
  return [
    picocolors.bold(fmtRow(header)),
    picocolors.dim(widths.map(w => '─'.repeat(w)).join('  ')),
    ...rows.map(fmtRow)
  ];
}

// ---------------------------------------------------------------------------
// Printing
// ---------------------------------------------------------------------------

export function printTraceResult(traceResult: TraceResult) {
  printTree(
    normalizeTraceClock(traceResult),
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

      if (node.children.length > 0) {
        parts.push(picocolors.dim(`self=${fmtMs(selfTime(node))}`));
      }

      const busy = loopBusy(node);
      if (busy) {
        parts.push(picocolors.dim(busy));
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

function printCategoryBreakdown(analysis: TraceAnalysis) {
  const grandTotal = analysis.categories.reduce((acc, c) => acc + c.selfTotal, 0);

  console.log();
  console.log(picocolors.bold('[time by category]'));
  console.log(picocolors.dim(
    '  self = span time not covered by traced children, summed across concurrent spans (so it exceeds wall;\n'
    + '         an async span on a busy event loop also includes time queued behind other work);\n'
    + '  coverage = wall-clock during which at least one span of that category was in flight;\n'
    + '  sync = the part of self that came from synchronous spans, i.e. guaranteed CPU on that thread'
  ));

  const rows = analysis.categories.reduce<string[][]>((acc, c) => {
    if (c.spans > 0) {
      acc.push([
        CATEGORY_COLOR[c.category](c.category),
        fmtMs(c.selfTotal),
        fmtPercent(c.selfTotal, grandTotal),
        fmtMs(c.coverage),
        fmtPercent(c.coverage, analysis.wall),
        String(c.spans),
        fmtMs(c.selfOnMainThread),
        fmtMs(c.selfOnWorkers),
        fmtMs(c.selfSync)
      ]);
    }
    return acc;
  }, []);

  table(['category', 'self', 'share', 'coverage', 'of wall', 'spans', 'main', 'workers', 'sync'], rows)
    .forEach(line => console.log('  ' + line));
}

function printTopSpans(analysis: TraceAnalysis) {
  console.log();
  console.log(picocolors.bold('[top spans by self time, per category]'));
  for (let i = 0, len = analysis.categories.length; i < len; i++) {
    const stat = analysis.categories[i];
    if (stat.top.length === 0) {
      continue;
    }
    console.log('  ' + categoryTag(stat.category));
    for (let j = 0, jlen = stat.top.length; j < jlen; j++) {
      const span = stat.top[j];
      const extra: string[] = [];
      if (span.node.children.length > 0) {
        extra.push(`wall=${fmtMs(span.duration)}`);
      }
      const busy = loopBusy(span.node);
      if (busy) {
        extra.push(busy);
      }
      if (span.node.thread !== 0) {
        extra.push(`@${threadLabel(span.node.thread)}`);
      }
      console.log(
        '    ',
        picocolors.bold(fmtMs(span.self).padStart(9)),
        fmtPath(span.path, 110),
        extra.length ? picocolors.dim(extra.join(' ')) : ''
      );
    }
  }

  console.log();
  console.log(picocolors.bold('[top spans by self time, overall]'));
  for (let i = 0, len = analysis.topSpans.length; i < len; i++) {
    const span = analysis.topSpans[i];
    console.log(
      '    ',
      picocolors.bold(fmtMs(span.self).padStart(9)),
      categoryTag(span.category).padEnd(16),
      fmtPath(span.path, 110)
    );
  }
}

function printTaskMatrix(analysis: TraceAnalysis) {
  if (analysis.tasks.length === 0) {
    return;
  }

  console.log();
  console.log(picocolors.bold('[time by task × category]'), picocolors.dim('(self time of the task and all its descendants)'));

  const usedCategories = CATEGORY_ORDER.filter(c => analysis.tasks.some(t => t.byCategory[c] > 0));

  const rows = analysis.tasks
    .toSorted((a, b) => b.duration - a.duration)
    .map((task) => {
      const busy = task.node.elu ? fmtPercent(task.node.elu.active, task.node.elu.active + task.node.elu.idle) : 'n/a';
      return [
        task.node.name + (task.node.thread === 0 ? '' : picocolors.dim(` @${threadLabel(task.node.thread)}`)),
        fmtMs(task.duration),
        busy,
        ...usedCategories.map(c => (task.byCategory[c] > 0 ? fmtMs(task.byCategory[c]) : picocolors.dim('·')))
      ];
    });

  table(['task', 'wall', 'loop-busy', ...usedCategories], rows)
    .forEach(line => console.log('  ' + line));
}

/**
 * The full post-build report: every task's span tree, then the aggregate views
 * (where does time go by category, which spans dominate, per-task breakdown and
 * the shared timeline).
 */
export function printBuildReport(traces: TraceResult[], usage?: BuildResourceUsage) {
  traces.forEach(printTraceResult);

  const analysis = analyzeTraces(traces);

  console.log();
  printOverview(analysis, usage);
  printCategoryBreakdown(analysis);
  printTopSpans(analysis);
  printTaskMatrix(analysis);
  console.log();
  printStats(traces);
}
