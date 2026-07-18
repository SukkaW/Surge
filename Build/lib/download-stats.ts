import picocolors from 'picocolors';
import { createPrettyBits, prettyBandwidth, prettyTraffic } from 'xbits';
import { appendArrayInPlace } from 'foxts/append-array-in-place';

export type ExternalDownloadOutcome = 'winner' | 'aborted' | 'failed';

export interface ExternalDownloadAttempt {
  url: string,
  kind: 'primary' | 'fallback',
  outcome: ExternalDownloadOutcome,
  startedAt: number,
  headersAt: number | null,
  decodedBodyStartedAt: number | null,
  encodedBodyStartedAt: number | null,
  encodedBodyEndedAt: number | null,
  endedAt: number,
  decodedBytes: number,
  encodedBytes: number,
  contentEncoding: string | null
}

export interface ExternalDownloadStatsSnapshot {
  attempts: ExternalDownloadAttempt[],
  startedAt: number | null,
  endedAt: number | null,
  totalDecodedBytes: number,
  usefulDecodedBytes: number,
  wastedDecodedBytes: number,
  totalEncodedBytes: number,
  usefulEncodedBytes: number,
  wastedEncodedBytes: number,
  winners: number,
  aborted: number,
  failed: number
}

function createEmptySnapshot(): ExternalDownloadStatsSnapshot {
  return {
    attempts: [],
    startedAt: null,
    endedAt: null,
    totalDecodedBytes: 0,
    usefulDecodedBytes: 0,
    wastedDecodedBytes: 0,
    totalEncodedBytes: 0,
    usefulEncodedBytes: 0,
    wastedEncodedBytes: 0,
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

function formatCompressionRatio(decodedBytes: number, encodedBytes: number) {
  return encodedBytes <= 0 ? 'n/a' : `${(decodedBytes / encodedBytes).toFixed(2)}x`;
}

export function recordExternalDownloadAttempt(attempt: ExternalDownloadAttempt) {
  stats.attempts.push(attempt);
  stats.startedAt = stats.startedAt == null ? attempt.startedAt : Math.min(stats.startedAt, attempt.startedAt);
  stats.endedAt = stats.endedAt == null ? attempt.endedAt : Math.max(stats.endedAt, attempt.endedAt);
  stats.totalDecodedBytes += attempt.decodedBytes;
  stats.totalEncodedBytes += attempt.encodedBytes;

  if (attempt.outcome === 'winner') {
    stats.winners++;
    stats.usefulDecodedBytes += attempt.decodedBytes;
    stats.usefulEncodedBytes += attempt.encodedBytes;
  } else {
    stats.wastedDecodedBytes += attempt.decodedBytes;
    stats.wastedEncodedBytes += attempt.encodedBytes;
    if (attempt.outcome === 'aborted') {
      stats.aborted++;
    } else {
      stats.failed++;
    }
  }
}

function printExternalDownloadAttempt(attempt: ExternalDownloadAttempt) {
  const ttfb = attempt.headersAt == null ? null : attempt.headersAt - attempt.startedAt;
  const queueWait = attempt.headersAt == null || attempt.decodedBodyStartedAt == null
    ? null
    : attempt.decodedBodyStartedAt - attempt.headersAt;
  const encodedBodyDuration = attempt.encodedBodyStartedAt == null || attempt.encodedBodyEndedAt == null
    ? null
    : attempt.encodedBodyEndedAt - attempt.encodedBodyStartedAt;
  const decodedBodyDuration = attempt.decodedBodyStartedAt == null
    ? null
    : attempt.endedAt - attempt.decodedBodyStartedAt;
  const encodedSpeed = encodedBodyDuration == null
    ? 'n/a'
    : formatDownloadSpeed(attempt.encodedBytes, encodedBodyDuration);
  const decodedSpeed = decodedBodyDuration == null
    ? 'n/a'
    : formatDownloadSpeed(attempt.decodedBytes, decodedBodyDuration);

  console.log(
    picocolors.gray('[external download]'),
    attempt.kind,
    attempt.outcome,
    `encoded=${prettyTraffic(attempt.encodedBytes)}`,
    encodedSpeed,
    `decoded=${prettyTraffic(attempt.decodedBytes)}`,
    decodedSpeed,
    `ratio=${formatCompressionRatio(attempt.decodedBytes, attempt.encodedBytes)}`,
    `encoding=${attempt.contentEncoding ?? 'identity'}`,
    `ttfb=${formatDuration(ttfb)}`,
    `queue=${formatDuration(queueWait)}`,
    attempt.url
  );
}

export function mergeExternalDownloadStats(snapshot: ExternalDownloadStatsSnapshot | undefined) {
  if (!snapshot) {
    return;
  }

  appendArrayInPlace(stats.attempts, snapshot.attempts);
  if (snapshot.startedAt != null) {
    stats.startedAt = stats.startedAt == null ? snapshot.startedAt : Math.min(stats.startedAt, snapshot.startedAt);
  }
  if (snapshot.endedAt != null) {
    stats.endedAt = stats.endedAt == null ? snapshot.endedAt : Math.max(stats.endedAt, snapshot.endedAt);
  }
  stats.totalDecodedBytes += snapshot.totalDecodedBytes;
  stats.usefulDecodedBytes += snapshot.usefulDecodedBytes;
  stats.wastedDecodedBytes += snapshot.wastedDecodedBytes;
  stats.totalEncodedBytes += snapshot.totalEncodedBytes;
  stats.usefulEncodedBytes += snapshot.usefulEncodedBytes;
  stats.wastedEncodedBytes += snapshot.wastedEncodedBytes;
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

  console.log(picocolors.bold('[external downloads]'), `attempts=${stats.attempts.length}`);
  stats.attempts
    .toSorted((a, b) => a.startedAt - b.startedAt)
    .forEach(printExternalDownloadAttempt);

  const duration = stats.endedAt - stats.startedAt;
  console.log(
    picocolors.bold('[external downloads total]'),
    `encoded-useful=${prettyTraffic(stats.usefulEncodedBytes)}`,
    `encoded-transferred=${prettyTraffic(stats.totalEncodedBytes)}`,
    `encoded-hedge-waste=${prettyTraffic(stats.wastedEncodedBytes)}`,
    `encoded-avg=${formatDownloadSpeed(stats.totalEncodedBytes, duration)}`,
    `decoded-useful=${prettyTraffic(stats.usefulDecodedBytes)}`,
    `decoded-avg=${formatDownloadSpeed(stats.totalDecodedBytes, duration)}`,
    `ratio=${formatCompressionRatio(stats.totalDecodedBytes, stats.totalEncodedBytes)}`,
    `wall=${formatDuration(duration)}`,
    `winner=${stats.winners}`,
    `aborted=${stats.aborted}`,
    `failed=${stats.failed}`
  );
}
