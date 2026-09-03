import process from 'node:process';
import os from 'node:os';
import fs from 'node:fs';

import { downloadPreviousBuild } from './download-previous-build';
import { buildCommon } from './build-common';
import { buildRejectIPList } from './build-reject-ip-list';
import { buildAppleCdn } from './build-apple-cdn';
import { buildAICIDR } from './build-ai-cidr';
import { buildRejectDomainSet } from './build-reject-domainset';
import { buildChnCidr } from './build-chn-cidr';
import { buildSpeedtestDomainSet } from './build-speedtest-domainset';
import { buildDomesticRuleset } from './build-domestic-direct-lan-ruleset-dns-mapping-module';
import { buildGlobalRuleset } from './build-global-server-dns-mapping';
import { buildStreamService } from './build-stream-service';

import { buildRedirectModule } from './build-sgmodule-redirect';
import { buildAlwaysRealIPModule } from './build-sgmodule-always-realip';

import { buildTelegram } from './build-telegram';
import { downloadMockAssets } from './download-mock-assets';

import { buildPublic } from './build-public';
import { buildCloudMounterRules } from './build-cloudmounter-rules';

import { printBuildReport, whyIsNodeRunning } from './trace';
import type { TraceResult } from './trace';
import { performance } from 'node:perf_hooks';
import { buildDeprecateFiles } from './build-deprecate-files';
import path from 'node:path';
import { ROOT_DIR } from './constants/dir';
import { isCI } from 'ci-info';
import { printExternalDownloadStats } from './lib/download-stats';
import { printWireStats } from './lib/download-wire-stats';
import { endBuildWorkerFarm, getBuildWorkerFarm, warmBuildWorkerFarm } from './lib/build-worker-farm';
import { appendArrayInPlace } from 'foxts/append-array-in-place';

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
  process.exit(1);
});

const buildFinishedLock = path.join(ROOT_DIR, '.BUILD_FINISHED');

(async () => {
  console.log('Version:', process.version);

  console.log(`OS: ${os.type()} ${os.release()} ${os.arch()}`);
  console.log(`Node.js: ${process.versions.node}`);
  console.log(`V8: ${process.versions.v8}`);

  const cpus = os.cpus()
    .reduce<Record<string, number>>((o, cpu) => {
      o[cpu.model] = (o[cpu.model] || 0) + 1;
      return o;
    }, {});

  console.log(`CPU: ${
    Object.keys(cpus)
      .map((key) => `${key} x ${cpus[key]}`)
      .join('\n')
  }`);
  if ('availableParallelism' in os) {
    console.log(`Available parallelism: ${os.availableParallelism()}`);
  }

  console.log(`Memory: ${os.totalmem() / (1024 * 1024)} MiB`);

  if (fs.existsSync(buildFinishedLock)) {
    fs.unlinkSync(buildFinishedLock);
  }

  // Build-wide resource baselines: how busy the main thread's event loop was
  // (CPU vs. waiting on I/O) and how much CPU the whole process (incl. worker
  // threads) burned relative to wall-clock.
  const eluAtStart = performance.eventLoopUtilization();
  const cpuAtStart = process.cpuUsage();

  // The one thread farm every off-main-thread job goes through: the reject
  // sources / phishing parse, the two trie-heavy CDN tasks, and any FileOutput
  // that crosses the offload threshold. Booted here rather than on first use so
  // the ~250ms-per-thread spin-up overlaps the first downloads instead of landing
  // on the critical path. Everything else is I/O-bound and stays on this thread.
  warmBuildWorkerFarm();
  const farm = getBuildWorkerFarm();

  try {
    // only enable why-is-node-running in GitHub Actions debug mode
    if (isCI && process.env.RUNNER_DEBUG === '1') {
      await import('why-is-node-running');
    }

    const downloadPreviousBuildPromise = downloadPreviousBuild();

    const [traces, telegramTraces]: [TraceResult[], TraceResult[]] = await Promise.all([
      Promise.all([
        downloadPreviousBuildPromise,
        downloadPreviousBuildPromise.then(() => buildCommon()),
        downloadPreviousBuildPromise.then(() => buildRejectIPList()),
        downloadPreviousBuildPromise.then(() => buildAppleCdn()),
        downloadPreviousBuildPromise.then(() => buildAICIDR()),
        downloadPreviousBuildPromise.then(() => farm.buildCdnDownloadConf()),
        downloadPreviousBuildPromise.then(() => buildRejectDomainSet()),
        downloadPreviousBuildPromise.then(() => buildChnCidr()),
        downloadPreviousBuildPromise.then(() => buildSpeedtestDomainSet()),
        downloadPreviousBuildPromise.then(() => buildDomesticRuleset()),
        downloadPreviousBuildPromise.then(() => buildGlobalRuleset()),
        downloadPreviousBuildPromise.then(() => buildRedirectModule()),
        downloadPreviousBuildPromise.then(() => buildAlwaysRealIPModule()),
        downloadPreviousBuildPromise.then(() => buildStreamService()),
        downloadPreviousBuildPromise.then(() => farm.buildMicrosoftCdn()),
        downloadPreviousBuildPromise.then(() => buildCloudMounterRules()),
        downloadMockAssets()
      ]),
      downloadPreviousBuildPromise.then(() => buildTelegram())
    ]);

    appendArrayInPlace(traces, telegramTraces);
    traces.push(await buildDeprecateFiles(), await buildPublic());

    // write a file to demonstrate that the build is finished
    fs.writeFileSync(buildFinishedLock, 'BUILD_FINISHED\n');

    printExternalDownloadStats();
    printWireStats();
    printBuildReport(traces, {
      elu: performance.eventLoopUtilization(eluAtStart),
      cpu: process.cpuUsage(cpuAtStart)
    });

    await endBuildWorkerFarm();

    // Finish the build to avoid leaking timer/fetch ref
    await whyIsNodeRunning();
    process.exit(0);
  } catch (e) {
    console.error('Something went wrong!');
    console.trace(e);
    process.exit(1);
  }
})();
