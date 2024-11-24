import process from 'node:process';
import os from 'node:os';

import { downloadPreviousBuild } from './download-previous-build';
import { buildCommon } from './build-common';
import { buildRejectIPList } from './build-reject-ip-list';
import { buildAppleCdn } from './build-apple-cdn';
import { buildCdnDownloadConf } from './build-cdn-download-conf';
import { buildRejectDomainSet } from './build-reject-domainset';
import { buildTelegramCIDR } from './build-telegram-cidr';
import { buildChnCidr } from './build-chn-cidr';
import { buildSpeedtestDomainSet } from './build-speedtest-domainset';
import { buildInternalReverseChnCIDR } from './build-internal-reverse-chn-cidr';
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
import { cacheGc } from './lib/make-fetch-happen';

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
  process.exit(1);
});

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
  console.log(`Memory: ${os.totalmem() / (1024 * 1024)} MiB`);

  const rootSpan = createSpan('root');

  try {
    const downloadPreviousBuildPromise = downloadPreviousBuild(rootSpan);

    const buildCommonPromise = downloadPreviousBuildPromise.then(() => buildCommon(rootSpan));
    const buildRejectIPListPromise = downloadPreviousBuildPromise.then(() => buildRejectIPList(rootSpan));
    const buildAppleCdnPromise = downloadPreviousBuildPromise.then(() => buildAppleCdn(rootSpan));
    const buildCdnConfPromise = downloadPreviousBuildPromise.then(() => buildCdnDownloadConf(rootSpan));
    const buildRejectDomainSetPromise = downloadPreviousBuildPromise.then(() => buildRejectDomainSet(rootSpan));
    const buildTelegramCIDRPromise = downloadPreviousBuildPromise.then(() => buildTelegramCIDR(rootSpan));
    const buildChnCidrPromise = downloadPreviousBuildPromise.then(() => buildChnCidr(rootSpan));
    const buildSpeedtestDomainSetPromise = downloadPreviousBuildPromise.then(() => buildSpeedtestDomainSet(rootSpan));

    const buildInternalReverseChnCIDRPromise = buildInternalReverseChnCIDR(rootSpan);

    // const buildInternalChnDomainsPromise = buildInternalChnDomains();
    const buildDomesticRulesetPromise = downloadPreviousBuildPromise.then(() => buildDomesticRuleset(rootSpan));

    const buildRedirectModulePromise = downloadPreviousBuildPromise.then(() => buildRedirectModule(rootSpan));
    const buildAlwaysRealIPModulePromise = downloadPreviousBuildPromise.then(() => buildAlwaysRealIPModule(rootSpan));

    const buildStreamServicePromise = downloadPreviousBuildPromise.then(() => buildStreamService(rootSpan));

    const buildMicrosoftCdnPromise = downloadPreviousBuildPromise.then(() => buildMicrosoftCdn(rootSpan));

    const buildSSPanelUIMAppProfilePromise = downloadPreviousBuildPromise.then(() => buildSSPanelUIMAppProfile(rootSpan));

    const downloadMockAssetsPromise = downloadMockAssets(rootSpan);

    const buildCloudMounterRulesPromise = downloadPreviousBuildPromise.then(() => buildCloudMounterRules(rootSpan));

    await Promise.all([
      downloadPreviousBuildPromise,
      buildCommonPromise,
      buildRejectIPListPromise,
      buildAppleCdnPromise,
      buildCdnConfPromise,
      buildRejectDomainSetPromise,
      buildTelegramCIDRPromise,
      buildChnCidrPromise,
      buildSpeedtestDomainSetPromise,
      buildInternalReverseChnCIDRPromise,
      buildInternalReverseChnCIDRPromise,
      // buildInternalChnDomainsPromise,
      buildDomesticRulesetPromise,
      buildRedirectModulePromise,
      buildAlwaysRealIPModulePromise,
      buildStreamServicePromise,
      buildMicrosoftCdnPromise,
      buildSSPanelUIMAppProfilePromise,
      buildCloudMounterRulesPromise,
      downloadMockAssetsPromise
    ]);

    await Promise.all([
      buildDeprecateFiles(rootSpan).then(() => buildPublic(rootSpan)),
      cacheGc(rootSpan)
    ]);

    rootSpan.stop();

    printTraceResult(rootSpan.traceResult);

    // Finish the build to avoid leaking timer/fetch ref
    await whyIsNodeRunning();
    process.exit(0);
  } catch (e) {
    console.error('Something went wrong!');
    console.trace(e);
    process.exit(1);
  }
})();
