import fs from 'node:fs';
import process from 'node:process';
import { getMethods } from './lib/is-domain-alive';
import { enumerateSourceDomains } from './lib/enumerate-source-domains';
import { getShardConfigFromEnv, isInShard } from './lib/shard';
import { getRunnerGeoIP } from './lib/get-runner-geoip';
import type { RunnerGeoIP } from './lib/get-runner-geoip';

import cliProgress from 'cli-progress';
import { newQueue } from '@henrygd/queue';

const queue = newQueue(32);

const deadDomains: string[] = [];

/**
 * Append this shard's result to the GitHub Actions job summary, if running in
 * CI. Each shard writes its own summary (no dedicated merge job) — the union
 * of all shards' summaries is the full dead-domain list.
 */
function formatGeo(geo: RunnerGeoIP | null): string {
  if (!geo) return 'unknown (geoip lookup failed)';
  return `${geo.ip} — ${geo.city}, ${geo.region}, ${geo.country} (AS${geo.asn} ${geo.asOrg})`;
}

function writeJobSummary(shardLabel: string, dead: string[], geo: RunnerGeoIP | null) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return;

  let summary = `## Dead domains — shard ${shardLabel}\n\n`
    + `Runner egress: \`${formatGeo(geo)}\`\n\n`
    + `Found **${dead.length}** dead domain(s) in this shard.\n\n`;

  if (dead.length > 0) {
    summary += '<details><summary>Show list</summary>\n\n'
      + '```\n'
      + dead.join('\n') + '\n'
      + '```\n\n'
      + '</details>\n\n'
      // Machine-recoverable copy so the union can be scraped from summaries.
      + '```json\n'
      + JSON.stringify(dead) + '\n'
      + '```\n\n';
  }

  fs.appendFileSync(summaryPath, summary);
}

(async () => {
  const shard = getShardConfigFromEnv();
  const shardLabel = `${shard.index + 1}/${shard.total}`;

  const [
    { isDomainAlive, isRegisterableDomainAlive },
    allDomains,
    geo
  ] = await Promise.all([
    getMethods(),
    enumerateSourceDomains(),
    getRunnerGeoIP()
  ]);

  console.log(`[shard ${shardLabel}] runner egress: ${formatGeo(geo)}`);

  const shardDomains = allDomains.filter(({ domain }) => isInShard(domain, shard));

  console.log(
    `[shard ${shardLabel}] checking ${shardDomains.length} of ${allDomains.length} domain(s)`
  );

  const bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
  bar.start(shardDomains.length, 0);

  for (const { domain, includeAllSubdomain } of shardDomains) {
    queue.add(async () => {
      let registerableDomainAlive, registerableDomain, alive: boolean | undefined;

      if (includeAllSubdomain) {
        // we only need to check apex domain, because we don't know if there is any stripped subdomain
        ({ alive: registerableDomainAlive, registerableDomain } = await isRegisterableDomainAlive(domain));
      } else {
        ({ alive, registerableDomainAlive, registerableDomain } = await isDomainAlive(domain));
      }

      bar.increment();

      if (!registerableDomainAlive) {
        if (registerableDomain) {
          deadDomains.push('.' + registerableDomain);
        }
      } else if (!includeAllSubdomain && alive != null && !alive) {
        deadDomains.push(domain);
      }
    });
  }

  await queue.done();

  bar.stop();

  console.log();
  console.log();
  console.log(`[shard ${shardLabel}]`, JSON.stringify(deadDomains));

  writeJobSummary(shardLabel, deadDomains, geo);
})();
