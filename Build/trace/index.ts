import path from 'path';
import picocolors from 'picocolors';

const SPAN_STATUS_START = 0;
const SPAN_STATUS_END = 1;

const NUM_OF_MS_IN_NANOSEC = 1_000_000;

const spanTag = Symbol('span');

export interface TraceResult {
  name: string,
  start: number,
  end: number,
  children: TraceResult[]
}

const rootTraceResult: TraceResult = {
  name: 'root',
  start: 0,
  end: 0,
  children: []
};

export interface Span {
  [spanTag]: true,
  readonly stop: (time?: number) => void,
  readonly traceChild: (name: string) => Span,
  readonly traceSyncFn: <T>(fn: (span: Span) => T) => T,
  readonly traceAsyncFn: <T>(fn: (span: Span) => T | Promise<T>) => Promise<T>,
  readonly tracePromise: <T>(promise: Promise<T>) => Promise<T>,
  readonly traceResult: TraceResult
}

export const createSpan = (name: string, parentTraceResult?: TraceResult): Span => {
  const start = Bun.nanoseconds();

  let curTraceResult: TraceResult;

  if (parentTraceResult == null) {
    curTraceResult = rootTraceResult;
  } else {
    curTraceResult = {
      name,
      start: start / NUM_OF_MS_IN_NANOSEC,
      end: 0,
      children: []
    };
    parentTraceResult.children.push(curTraceResult);
  }

  let status: typeof SPAN_STATUS_START | typeof SPAN_STATUS_END = SPAN_STATUS_START;

  const stop = (time?: number) => {
    if (status === SPAN_STATUS_END) {
      throw new Error(`span already stopped: ${name}`);
    }
    const end = time ?? Bun.nanoseconds();

    curTraceResult.end = end / NUM_OF_MS_IN_NANOSEC;

    status = SPAN_STATUS_END;
  };

  const traceChild = (name: string) => createSpan(name, curTraceResult);

  const span: Span = {
    [spanTag]: true,
    stop,
    traceChild,
    traceSyncFn<T>(fn: (span: Span) => T) {
      try {
        return fn(span);
      } finally {
        span.stop();
      }
    },
    async traceAsyncFn<T>(fn: (span: Span) => T | Promise<T>): Promise<T> {
      try {
        return await fn(span);
      } finally {
        span.stop();
      }
    },
    get traceResult() {
      return curTraceResult;
    },
    async tracePromise<T>(promise: Promise<T>): Promise<T> {
      try {
        return await promise;
      } finally {
        span.stop();
      }
    }
  };

  // eslint-disable-next-line sukka/no-redundant-variable -- self reference
  return span;
};

export const task = <T>(importMetaPath: string, fn: (span: Span) => T, customname?: string) => {
  const taskName = customname ?? path.basename(importMetaPath, path.extname(importMetaPath));
  return async (span?: Span) => {
    if (span) {
      return span.traceChild(taskName).traceAsyncFn(fn);
    }
    return fn(createSpan(taskName));
  };
};

const isSpan = (obj: any): obj is Span => {
  return typeof obj === 'object' && obj && spanTag in obj;
};

export const universalify = <A extends any[], R>(taskname: string, fn: (this: void, ...args: A) => R) => {
  return (...args: A) => {
    const lastArg = args[args.length - 1];
    if (isSpan(lastArg)) {
      return lastArg.traceChild(taskname).traceSyncFn(() => fn(...args));
    }
    return fn(...args);
  };
};

export const printTraceResult = (traceResult: TraceResult = rootTraceResult) => {
  printStats(traceResult.children);
  printTree(traceResult, node => `${node.name} ${picocolors.bold(`${(node.end - node.start).toFixed(3)}ms`)}`);
};

function printTree(initialTree: TraceResult, printNode: (node: TraceResult, branch: string) => string) {
  function printBranch(tree: TraceResult, branch: string) {
    const isGraphHead = branch.length === 0;
    const children = tree.children;

    let branchHead = '';

    if (!isGraphHead) {
      branchHead = children.length > 0 ? '┬ ' : '─ ';
    }

    const toPrint = printNode(tree, `${branch}${branchHead}`);

    if (typeof toPrint === 'string') {
      console.log(`${branch}${branchHead}${toPrint}`);
    }

    let baseBranch = branch;

    if (!isGraphHead) {
      const isChildOfLastBranch = branch.endsWith('└─');
      baseBranch = branch.slice(0, -2) + (isChildOfLastBranch ? '  ' : '│ ');
    }

    const nextBranch = `${baseBranch}├─`;
    const lastBranch = `${baseBranch}└─`;

    children.forEach((child, index) => {
      printBranch(child, children.length - 1 === index ? lastBranch : nextBranch);
    });
  }

  printBranch(initialTree, '');
}

function printStats(stats: TraceResult[]): void {
  stats.sort((a, b) => a.start - b.start);

  const longestTaskName = Math.max(...stats.map(i => i.name.length));
  const realStart = Math.min(...stats.map(i => i.start));
  const realEnd = Math.max(...stats.map(i => i.end));

  const statsStep = ((realEnd - realStart) / 160) | 0;

  stats.forEach(stat => {
    console.log(
      `[${stat.name}]${' '.repeat(longestTaskName - stat.name.length)}`,
      ' '.repeat(((stat.start - realStart) / statsStep) | 0),
      '='.repeat(Math.max(((stat.end - stat.start) / statsStep) | 0, 1))
    );
  });
}
