import picocolors from 'picocolors';
import { createPrettyBits, prettyBandwidth, prettyTraffic } from 'xbits';

export type ExternalDownloadOutcome = 'winner' | 'aborted' | 'failed';

export interface ExternalDownloadAttempt {
  url: string,
  kind: 'primary' | 'fallback',
  outcome: ExternalDownloadOutcome,
  startedAt: number,
  headersAt: number | null,
  bodyStartedAt: number | null,
  endedAt: number,
  bytes: number
}

export interface ExternalDownloadStatsSnapshot {
  startedAt: number | null,
  endedAt: number | null,
  totalBytes: number,
  usefulBytes: number,
  wastedBytes: number,
  winners: number,
  aborted: number,
  failed: number
}

function createEmptySnapshot(): ExternalDownloadStatsSnapshot {
  return {
    startedAt: null,
    endedAt: null,
    totalBytes: 0,
    usefulBytes: 0,
    wastedBytes: 0,
    winners: 0,
    aborted: 0,
    failed: 0
  };
}

let stats = createEmptySnapshot();
const prettyBinaryByteSpeed = createPrettyBits({
  bits: false,
  binary: true,
  speed: true,
  largeK: true
});

export function downloadTimestamp() {
  return performance.timeOrigin + performance.now();
}

export function formatDownloadSpeed(bytes: number, duration: number) {
  if (duration <= 0) {
    return 'n/a';
  }
  const bytesPerSecond = bytes / duration * 1000;
  return `${prettyBinaryByteSpeed(bytesPerSecond)} (${prettyBandwidth(bytesPerSecond * 8)})`;
}

function formatDuration(duration: number | null) {
  return duration == null ? 'n/a' : `${duration.toFixed(1)}ms`;
}

export function recordExternalDownloadAttempt(attempt: ExternalDownloadAttempt) {
  stats.startedAt = stats.startedAt == null ? attempt.startedAt : Math.min(stats.startedAt, attempt.startedAt);
  stats.endedAt = stats.endedAt == null ? attempt.endedAt : Math.max(stats.endedAt, attempt.endedAt);
  stats.totalBytes += attempt.bytes;

  if (attempt.outcome === 'winner') {
    stats.winners++;
    stats.usefulBytes += attempt.bytes;
  } else {
    stats.wastedBytes += attempt.bytes;
    if (attempt.outcome === 'aborted') {
      stats.aborted++;
    } else {
      stats.failed++;
    }
  }

  const ttfb = attempt.headersAt == null ? null : attempt.headersAt - attempt.startedAt;
  const queueWait = attempt.headersAt == null || attempt.bodyStartedAt == null
    ? null
    : attempt.bodyStartedAt - attempt.headersAt;
  const bodyDuration = attempt.bodyStartedAt == null ? null : attempt.endedAt - attempt.bodyStartedAt;
  const speed = bodyDuration == null ? 'n/a' : formatDownloadSpeed(attempt.bytes, bodyDuration);

  console.log(
    picocolors.gray('[external download]'),
    attempt.kind,
    attempt.outcome,
    prettyTraffic(attempt.bytes),
    speed,
    `ttfb=${formatDuration(ttfb)}`,
    `queue=${formatDuration(queueWait)}`,
    attempt.url
  );
}

export function mergeExternalDownloadStats(snapshot: ExternalDownloadStatsSnapshot | undefined) {
  if (!snapshot) {
    return;
  }

  if (snapshot.startedAt != null) {
    stats.startedAt = stats.startedAt == null ? snapshot.startedAt : Math.min(stats.startedAt, snapshot.startedAt);
  }
  if (snapshot.endedAt != null) {
    stats.endedAt = stats.endedAt == null ? snapshot.endedAt : Math.max(stats.endedAt, snapshot.endedAt);
  }
  stats.totalBytes += snapshot.totalBytes;
  stats.usefulBytes += snapshot.usefulBytes;
  stats.wastedBytes += snapshot.wastedBytes;
  stats.winners += snapshot.winners;
  stats.aborted += snapshot.aborted;
  stats.failed += snapshot.failed;
}

export function takeExternalDownloadStats() {
  const snapshot = stats;
  stats = createEmptySnapshot();
  return snapshot;
}

export function printExternalDownloadStats() {
  if (stats.startedAt == null || stats.endedAt == null) {
    return;
  }

  const duration = stats.endedAt - stats.startedAt;
  console.log(
    picocolors.bold('[external downloads total]'),
    `useful=${prettyTraffic(stats.usefulBytes)}`,
    `transferred=${prettyTraffic(stats.totalBytes)}`,
    `hedge-waste=${prettyTraffic(stats.wastedBytes)}`,
    `avg=${formatDownloadSpeed(stats.totalBytes, duration)}`,
    `wall=${formatDuration(duration)}`,
    `winner=${stats.winners}`,
    `aborted=${stats.aborted}`,
    `failed=${stats.failed}`
  );
}
