import process from 'node:process';
import os from 'node:os';
import fs from 'node:fs';

import { downloadPreviousBuild } from './download-previous-build';
import { buildCommon } from './build-common';
import { buildRejectIPList } from './build-reject-ip-list';
import { buildAppleCdn } from './build-apple-cdn';
import { buildRejectDomainSet } from './build-reject-domainset';
import { buildChnCidr } from './build-chn-cidr';
import { buildSpeedtestDomainSet } from './build-speedtest-domainset';
import { buildDomesticRuleset } from './build-domestic-direct-lan-ruleset-dns-mapping-module';
import { buildGlobalRuleset } from './build-global-server-dns-mapping';
import { buildStreamService } from './build-stream-service';

import { buildRedirectModule } from './build-sgmodule-redirect';
import { buildAlwaysRealIPModule } from './build-sgmodule-always-realip';

import { createWorker } from './lib/worker';

import { buildPublic } from './build-public';
import { buildCloudMounterRules } from './build-cloudmounter-rules';

import { printStats, printTraceResult, whyIsNodeRunning } from './trace';
import type { TraceResult } from './trace';
import { buildDeprecateFiles } from './build-deprecate-files';
import path from 'node:path';
import { ROOT_DIR } from './constants/dir';
import { isCI } from 'ci-info';

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

  const microsoftCdnWorker = createWorker<typeof import('./build-microsoft-cdn.worker')>(
    require.resolve('./build-microsoft-cdn.worker')
  )(['buildMicrosoftCdn']);

  const cdnDownloadWorker = createWorker<typeof import('./build-cdn-download-conf.worker')>(
    require.resolve('./build-cdn-download-conf.worker')
  )(['buildCdnDownloadConf']);

  const telegramCidrWorker = createWorker<typeof import('./build-telegram-cidr.worker')>(
    require.resolve('./build-telegram-cidr.worker')
  )(['buildTelegramCIDR']);

  const mockAssetsWorker = createWorker<typeof import('./download-mock-assets.worker')>(
    require.resolve('./download-mock-assets.worker')
  )(['downloadMockAssets']);

  try {
    // only enable why-is-node-running in GitHub Actions debug mode
    if (isCI && process.env.RUNNER_DEBUG === '1') {
      await import('why-is-node-running');
    }

    const downloadPreviousBuildPromise = downloadPreviousBuild();

    const traces: TraceResult[] = await Promise.all([
      downloadPreviousBuildPromise,
      downloadPreviousBuildPromise.then(() => buildCommon()),
      downloadPreviousBuildPromise.then(() => buildRejectIPList()),
      downloadPreviousBuildPromise.then(() => buildAppleCdn()),
      downloadPreviousBuildPromise.then(() => cdnDownloadWorker.buildCdnDownloadConf()),
      downloadPreviousBuildPromise.then(() => buildRejectDomainSet()),
      downloadPreviousBuildPromise.then(() => telegramCidrWorker.buildTelegramCIDR()),
      downloadPreviousBuildPromise.then(() => buildChnCidr()),
      downloadPreviousBuildPromise.then(() => buildSpeedtestDomainSet()),
      downloadPreviousBuildPromise.then(() => buildDomesticRuleset()),
      downloadPreviousBuildPromise.then(() => buildGlobalRuleset()),
      downloadPreviousBuildPromise.then(() => buildRedirectModule()),
      downloadPreviousBuildPromise.then(() => buildAlwaysRealIPModule()),
      downloadPreviousBuildPromise.then(() => buildStreamService()),
      downloadPreviousBuildPromise.then(() => microsoftCdnWorker.buildMicrosoftCdn()),
      downloadPreviousBuildPromise.then(() => buildCloudMounterRules()),
      mockAssetsWorker.downloadMockAssets()
    ]);

    traces.push(
      await buildDeprecateFiles(),
      await buildPublic()
    );

    // write a file to demonstrate that the build is finished
    fs.writeFileSync(buildFinishedLock, 'BUILD_FINISHED\n');

    traces.forEach((t) => {
      printTraceResult(t);
    });
    printStats(traces);

    await microsoftCdnWorker.end();
    await cdnDownloadWorker.end();
    await telegramCidrWorker.end();
    await mockAssetsWorker.end();

    // Finish the build to avoid leaking timer/fetch ref
    await whyIsNodeRunning();
    process.exit(0);
  } catch (e) {
    console.error('Something went wrong!');
    console.trace(e);
    process.exit(1);
  }
})();
