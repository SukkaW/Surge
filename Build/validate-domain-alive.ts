import fs from 'node:fs';
import process from 'node:process';
import { getMethods } from './lib/is-domain-alive';
import { enumerateSourceDomains } from './lib/enumerate-source-domains';
import { getShardConfigFromEnv, isInShard } from './lib/shard';
import { getRunnerGeoIP } from './lib/get-runner-geoip';
import type { RunnerGeoIP } from './lib/get-runner-geoip';

import cliProgress from 'cli-progress';
import { newQueue } from '@henrygd/queue';
import { DOMAIN_ALIVE_REASON_MESSAGES } from 'domain-alive';
import type { DomainAliveReason } from 'domain-alive';

const queue = newQueue(32);
const domainCollator = new Intl.Collator('en');

interface DeadDomain {
  domain: string,
  reason: DomainAliveReason
}

const deadDomains: DeadDomain[] = [];

/**
 * Append this shard's result to the GitHub Actions job summary, if running in
 * CI. Each shard writes its own summary (no dedicated merge job) — the union
 * of all shards' summaries is the full dead-domain list.
 */
function formatGeo(geo: RunnerGeoIP | null): string {
  if (!geo) return 'unknown (geoip lookup failed)';
  return `${geo.ip} — ${geo.city}, ${geo.region}, ${geo.country} (AS${geo.asn} ${geo.asOrg})`;
}

function writeJobSummary(shardLabel: string, dead: DeadDomain[], geo: RunnerGeoIP | null) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return;

  const sortedDead = dead.toSorted((a, b) => domainCollator.compare(a.domain, b.domain));

  let summary = `## Dead domains — shard ${shardLabel}\n\n`
    + `Runner egress: \`${formatGeo(geo)}\`\n\n`
    + `Found **${dead.length}** dead domain(s) in this shard.\n\n`;

  if (dead.length > 0) {
    summary += '<details><summary>Show list and reasons</summary>\n\n'
      + '| Domain | Reason | Explanation |\n'
      + '| --- | --- | --- |\n'
      + sortedDead.map(({ domain, reason }) => (
        `| \`${domain}\` | \`${reason}\` | ${DOMAIN_ALIVE_REASON_MESSAGES[reason]} |`
      )).join('\n') + '\n\n'
      + '</details>\n\n'
      // Preserve the original machine-recoverable domain list format.
      + '```json\n'
      + JSON.stringify(sortedDead.map(({ domain }) => domain)) + '\n'
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

  for (let i = 0, len = shardDomains.length; i < len; i++) {
    const { domain, includeAllSubdomain } = shardDomains[i];
    queue.add(async () => {
      if (includeAllSubdomain) {
        // we only need to check apex domain, because we don't know if there is any stripped subdomain
        const { alive, registerableDomain, reason } = await isRegisterableDomainAlive(domain);
        bar.increment();

        if (!alive && registerableDomain) {
          deadDomains.push({ domain: '.' + registerableDomain, reason });
        }
        return;
      }

      const { alive, registerableDomainAlive, registerableDomain, reason } = await isDomainAlive(domain);
      bar.increment();

      if (!registerableDomainAlive) {
        if (registerableDomain) {
          deadDomains.push({ domain: '.' + registerableDomain, reason });
        }
      } else if (!alive) {
        deadDomains.push({ domain, reason });
      }
    });
  }

  await queue.done();

  bar.stop();

  console.log();
  console.log();
  console.log(`[shard ${shardLabel}]`, JSON.stringify(deadDomains.map(({ domain }) => domain)));

  writeJobSummary(shardLabel, deadDomains, geo);
})();
