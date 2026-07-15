/**
 * Deterministic domain sharding for spreading the domain-alive check across
 * multiple GitHub Actions runners.
 *
 * GitHub-hosted runners are provisioned across many Azure regions, so each
 * matrix job gets a distinct egress IP. Splitting the workload by a stable
 * hash of the domain lets every runner enumerate the *same* source files but
 * only check the subset that belongs to its shard, which:
 *
 *   - spreads DoH load across N distinct egress IPs (fewer per-server rate
 *     limits), and
 *   - makes assignment deterministic — the same domain always lands on the
 *     same shard, so duplicates across source files collapse to one check and
 *     re-runs are reproducible.
 *
 * FNV-1a (52-bit, via foxts/fnv1a52) is used because it is fast, has good
 * distribution for load balancing, and stays within JavaScript's safe integer
 * range. It is NOT cryptographic — never use it where collision resistance
 * matters.
 */

import { fnv1a52 } from 'foxts/fnv1a52';
import process from 'node:process';

export interface ShardConfig {
  /** 0-based index of this shard. */
  index: number,
  /** Total number of shards. */
  total: number
}

/**
 * Read shard configuration from the environment. Defaults to a single shard
 * (index 0 of 1), i.e. a full run — so local invocations and the non-matrix
 * path behave exactly like before.
 */
export function getShardConfigFromEnv(env: NodeJS.ProcessEnv = process.env): ShardConfig {
  const total = Number.parseInt(env.SHARD_TOTAL ?? '1', 10);
  const index = Number.parseInt(env.SHARD_INDEX ?? '0', 10);

  if (!Number.isSafeInteger(total) || total < 1) {
    throw new RangeError(`Invalid SHARD_TOTAL: ${JSON.stringify(env.SHARD_TOTAL)} (must be an integer >= 1)`);
  }
  if (!Number.isSafeInteger(index) || index < 0 || index >= total) {
    throw new RangeError(`Invalid SHARD_INDEX: ${JSON.stringify(env.SHARD_INDEX)} (must be an integer in [0, ${total - 1}])`);
  }

  return { index, total };
}

/** Whether the given domain belongs to this shard. */
export function isInShard(domain: string, { index, total }: ShardConfig): boolean {
  if (total === 1) return true;
  return fnv1a52(domain) % total === index;
}
