import { downloadPreviousBuild } from './download-previous-build';
import { buildCommon } from './build-common';
import { buildAntiBogusDomain } from './build-anti-bogus-domain';
import { buildAppleCdn } from './build-apple-cdn';
import { buildCdnDownloadConf } from './build-cdn-download-conf';
import { buildRejectDomainSet } from './build-reject-domainset';
import { buildTelegramCIDR } from './build-telegram-cidr';
import { buildChnCidr } from './build-chn-cidr';
import { buildSpeedtestDomainSet } from './build-speedtest-domainset';
import { buildInternalCDNDomains } from './build-internal-cdn-rules';
// import { buildInternalChnDomains } from './build-internal-chn-domains';
import { buildInternalReverseChnCIDR } from './build-internal-reverse-chn-cidr';
import { buildDomesticRuleset } from './build-domestic-ruleset';
import { buildStreamService } from './build-stream-service';

import { buildRedirectModule } from './build-sgmodule-redirect';
import { buildAlwaysRealIPModule } from './build-sgmodule-always-realip';

import { validate } from './validate-domainset';

import { buildMicrosoftCdn } from './build-microsoft-cdn';
import { buildSSPanelUIMAppProfile } from './build-sspanel-appprofile';

import { buildPublic } from './build-public';
import { downloadMockAssets } from './download-mock-assets';

import { buildCloudMounterRules } from './build-cloudmounter-rules';

import { createSpan, printTraceResult } from './trace';
import { buildDeprecateFiles } from './build-deprecate-files';

console.log('Bun version:', Bun.version, Bun.revision);

(async () => {
  const rootSpan = createSpan('root');

  try {
    // const buildInternalReverseChnCIDRWorker = new Worker(new URL('./workers/build-internal-reverse-chn-cidr-worker.ts', import.meta.url));

    const downloadPreviousBuildPromise = downloadPreviousBuild(rootSpan);

    const buildCommonPromise = downloadPreviousBuildPromise.then(() => buildCommon(rootSpan));
    const buildAntiBogusDomainPromise = downloadPreviousBuildPromise.then(() => buildAntiBogusDomain(rootSpan));
    const buildAppleCdnPromise = downloadPreviousBuildPromise.then(() => buildAppleCdn(rootSpan));
    const buildCdnConfPromise = downloadPreviousBuildPromise.then(() => buildCdnDownloadConf(rootSpan));
    const buildRejectDomainSetPromise = downloadPreviousBuildPromise.then(() => buildRejectDomainSet(rootSpan));
    const buildTelegramCIDRPromise = downloadPreviousBuildPromise.then(() => buildTelegramCIDR(rootSpan));
    const buildChnCidrPromise = downloadPreviousBuildPromise.then(() => buildChnCidr(rootSpan));
    const buildSpeedtestDomainSetPromise = downloadPreviousBuildPromise.then(() => buildSpeedtestDomainSet(rootSpan));
    const buildInternalCDNDomainsPromise = Promise.all([
      buildCommonPromise,
      buildCdnConfPromise
    ]).then(() => buildInternalCDNDomains(rootSpan));

    const buildInternalReverseChnCIDRPromise = buildInternalReverseChnCIDR(rootSpan);

    // const buildInternalChnDomainsPromise = buildInternalChnDomains();
    const buildDomesticRulesetPromise = downloadPreviousBuildPromise.then(() => buildDomesticRuleset(rootSpan));

    const buildRedirectModulePromise = downloadPreviousBuildPromise.then(() => buildRedirectModule(rootSpan));
    const buildAlwaysRealIPModulePromise = downloadPreviousBuildPromise.then(() => buildAlwaysRealIPModule(rootSpan));

    const buildStreamServicePromise = downloadPreviousBuildPromise.then(() => buildStreamService(rootSpan));

    const buildMicrosoftCdnPromise = downloadPreviousBuildPromise.then(() => buildMicrosoftCdn(rootSpan));

    const buildSSPanelUIMAppProfilePromise = Promise.all([
      downloadPreviousBuildPromise
    ]).then(() => buildSSPanelUIMAppProfile(rootSpan));

    const downloadMockAssetsPromise = downloadMockAssets(rootSpan);

    const buildCloudMounterRulesPromise = downloadPreviousBuildPromise.then(() => buildCloudMounterRules(rootSpan));

    const buildDeprecateFilesPromise = downloadPreviousBuildPromise.then(() => buildDeprecateFiles(rootSpan));

    await Promise.all([
      downloadPreviousBuildPromise,
      buildCommonPromise,
      buildAntiBogusDomainPromise,
      buildAppleCdnPromise,
      buildCdnConfPromise,
      buildRejectDomainSetPromise,
      buildTelegramCIDRPromise,
      buildChnCidrPromise,
      buildSpeedtestDomainSetPromise,
      buildInternalCDNDomainsPromise,
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
      buildDeprecateFilesPromise,
      downloadMockAssetsPromise
    ]);

    await Promise.all([
      buildPublic(rootSpan),
      validate(rootSpan)
    ]);

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
