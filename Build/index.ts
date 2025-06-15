import process from 'node:process';
import os from 'node:os';
import fs from 'node:fs';
import fsp from 'node:fs/promises';

import { downloadPreviousBuild } from './download-previous-build';
import { buildCommon } from './build-common';
import { buildRejectIPList } from './build-reject-ip-list';
import { buildAppleCdn } from './build-apple-cdn';
import { buildCdnDownloadConf } from './build-cdn-download-conf';
import { buildRejectDomainSet } from './build-reject-domainset';
import { buildTelegramCIDR } from './build-telegram-cidr';
import { buildChnCidr } from './build-chn-cidr';
import { buildSpeedtestDomainSet } from './build-speedtest-domainset';
import { buildDomesticRuleset } from './build-domestic-direct-lan-ruleset-dns-mapping-module';
import { buildStreamService } from './build-stream-service';

import { buildRedirectModule } from './build-sgmodule-redirect';
import { buildAlwaysRealIPModule } from './build-sgmodule-always-realip';

import { buildMicrosoftCdn } from './build-microsoft-cdn';
import { buildSSPanelUIMAppProfile } from './build-sspanel-appprofile';

import { buildPublic } from './build-public';
import { downloadMockAssets } from './download-mock-assets';

import { buildCloudMounterRules } from './build-cloudmounter-rules';

import { createSpan, printTraceResult, whyIsNodeRunning } from './trace';
import { buildDeprecateFiles } from './build-deprecate-files';
import path from 'node:path';
import { CACHE_DIR, ROOT_DIR } from './constants/dir';
import { isCI } from 'ci-info';

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
  process.exit(1);
});

const removesFiles = [
  path.join(CACHE_DIR, '.cache.db'),
  path.join(CACHE_DIR, '.cache.db-shm'),
  path.join(CACHE_DIR, '.cache.db-wal')
];

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

  const rootSpan = createSpan('root');

  if (fs.existsSync(buildFinishedLock)) {
    fs.unlinkSync(buildFinishedLock);
  }

  try {
    // only enable why-is-node-running in GitHub Actions debug mode
    if (isCI && process.env.RUNNER_DEBUG === '1') {
      await import('why-is-node-running');
    }

    const downloadPreviousBuildPromise = downloadPreviousBuild(rootSpan);
    const buildCommonPromise = downloadPreviousBuildPromise.then(() => buildCommon(rootSpan));

    await Promise.all([
      ...removesFiles.map(file => fsp.rm(file, { force: true })),
      downloadPreviousBuildPromise,
      buildCommonPromise,
      downloadPreviousBuildPromise.then(() => buildRejectIPList(rootSpan)),
      downloadPreviousBuildPromise.then(() => buildAppleCdn(rootSpan)),
      downloadPreviousBuildPromise.then(() => buildCdnDownloadConf(rootSpan)),
      downloadPreviousBuildPromise.then(() => buildRejectDomainSet(rootSpan)),
      downloadPreviousBuildPromise.then(() => buildTelegramCIDR(rootSpan)),
      downloadPreviousBuildPromise.then(() => buildChnCidr(rootSpan)),
      downloadPreviousBuildPromise.then(() => buildSpeedtestDomainSet(rootSpan)),
      downloadPreviousBuildPromise.then(() => buildDomesticRuleset(rootSpan)),
      downloadPreviousBuildPromise.then(() => buildRedirectModule(rootSpan)),
      downloadPreviousBuildPromise.then(() => buildAlwaysRealIPModule(rootSpan)),
      downloadPreviousBuildPromise.then(() => buildStreamService(rootSpan)),
      downloadPreviousBuildPromise.then(() => buildMicrosoftCdn(rootSpan)),
      Promise.all([
        downloadPreviousBuildPromise,
        buildCommonPromise
      ]).then(() => buildSSPanelUIMAppProfile(rootSpan)),
      downloadPreviousBuildPromise.then(() => buildCloudMounterRules(rootSpan)),
      downloadMockAssets(rootSpan)
    ]);

    await buildDeprecateFiles(rootSpan);
    await buildPublic(rootSpan);

    rootSpan.stop();

    printTraceResult(rootSpan.traceResult);

    // write a file to demonstrate that the build is finished
    fs.writeFileSync(buildFinishedLock, 'BUILD_FINISHED\n');

    // Finish the build to avoid leaking timer/fetch ref
    await whyIsNodeRunning();
    process.exit(0);
  } catch (e) {
    console.error('Something went wrong!');
    console.trace(e);
    process.exit(1);
  }
})();
