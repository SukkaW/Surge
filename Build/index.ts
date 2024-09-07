import process from 'node:process';

console.log('Version:', process.version);

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

import { createSpan, printTraceResult } from './trace';
import { buildDeprecateFiles } from './build-deprecate-files';

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
  process.exit(1);
});

(async () => {
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

    await buildDeprecateFiles(rootSpan);
    await buildPublic(rootSpan);

    rootSpan.stop();

    printTraceResult(rootSpan.traceResult);

    // Finish the build to avoid leaking timer/fetch ref
    process.exit(0);
  } catch (e) {
    console.trace(e);
    console.error('Something went wrong!');
    process.exit(1);
  }
})();
