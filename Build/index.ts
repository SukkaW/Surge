import { downloadPreviousBuild } from './download-previous-build';
import { buildCommon } from './build-common';
import { buildAntiBogusDomain } from './build-anti-bogus-domain';
import { buildAppleCdn } from './build-apple-cdn';
import { buildCdnConf } from './build-cdn-conf';
import { buildRejectDomainSet } from './build-reject-domainset';
import { buildTelegramCIDR } from './build-telegram-cidr';
import { buildChnCidr } from './build-chn-cidr';
import { buildSpeedtestDomainSet } from './build-speedtest-domainset';
import { buildInternalCDNDomains } from './build-internal-cdn-rules';
// import { buildInternalChnDomains } from './build-internal-chn-domains';
import { buildDomesticRuleset } from './build-domestic-ruleset';
import { buildStreamService } from './build-stream-service';

import { buildRedirectModule } from './build-sgmodule-redirect';
import { buildAlwaysRealIPModule } from './build-sgmodule-always-realip';

import { validate } from './validate-domainset';

import { buildMicrosoftCdn } from './build-microsoft-cdn';
import { buildSSPanelUIMAppProfile } from './build-sspanel-appprofile';

import { buildPublic } from './build-public';
import { downloadMockAssets } from './download-mock-assets';

import type { TaskResult } from './lib/trace-runner';

(async () => {
  console.log('Bun version:', Bun.version, Bun.revision);

  try {
    // TODO: restore this once Bun has fixed their worker
    // const buildInternalReverseChnCIDRWorker = new Worker(new URL('./workers/build-internal-reverse-chn-cidr-worker.ts', import.meta.url));

    const downloadPreviousBuildPromise = downloadPreviousBuild();
    const buildCommonPromise = downloadPreviousBuildPromise.then(() => buildCommon());
    const buildAntiBogusDomainPromise = downloadPreviousBuildPromise.then(() => buildAntiBogusDomain());
    const buildAppleCdnPromise = downloadPreviousBuildPromise.then(() => buildAppleCdn());
    const buildCdnConfPromise = downloadPreviousBuildPromise.then(() => buildCdnConf());
    const buildRejectDomainSetPromise = downloadPreviousBuildPromise.then(() => buildRejectDomainSet());
    const buildTelegramCIDRPromise = downloadPreviousBuildPromise.then(() => buildTelegramCIDR());
    const buildChnCidrPromise = downloadPreviousBuildPromise.then(() => buildChnCidr());
    const buildSpeedtestDomainSetPromise = downloadPreviousBuildPromise.then(() => buildSpeedtestDomainSet());
    const buildInternalCDNDomainsPromise = Promise.all([
      buildCommonPromise,
      buildCdnConfPromise
    ]).then(() => buildInternalCDNDomains());

    // const buildInternalReverseChnCIDRPromise = new Promise<TaskResult>(resolve => {
    //   const handleMessage = (e: MessageEvent<TaskResult>) => {
    //     const { data } = e;

    //     buildInternalReverseChnCIDRWorker.postMessage('exit');
    //     buildInternalReverseChnCIDRWorker.removeEventListener('message', handleMessage);
    //     resolve(data);
    //   };
    //   buildInternalReverseChnCIDRWorker.addEventListener('message', handleMessage);
    //   buildInternalReverseChnCIDRWorker.postMessage('build');
    // });

    // const buildInternalChnDomainsPromise = buildInternalChnDomains();
    const buildDomesticRulesetPromise = downloadPreviousBuildPromise.then(() => buildDomesticRuleset());

    const buildRedirectModulePromise = downloadPreviousBuildPromise.then(() => buildRedirectModule());
    const buildAlwaysRealIPModulePromise = downloadPreviousBuildPromise.then(() => buildAlwaysRealIPModule());

    const buildStreamServicePromise = downloadPreviousBuildPromise.then(() => buildStreamService());

    const buildMicrosoftCdnPromise = downloadPreviousBuildPromise.then(() => buildMicrosoftCdn());

    const buildSSPanelUIMAppProfilePromise = Promise.all([
      downloadPreviousBuildPromise
    ]).then(() => buildSSPanelUIMAppProfile());

    const downloadMockAssetsPromise = downloadMockAssets();

    const stats = await Promise.all([
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
      // buildInternalReverseChnCIDRPromise,
      // buildInternalChnDomainsPromise,
      buildDomesticRulesetPromise,
      buildRedirectModulePromise,
      buildAlwaysRealIPModulePromise,
      buildStreamServicePromise,
      buildMicrosoftCdnPromise,
      buildSSPanelUIMAppProfilePromise,

      downloadMockAssetsPromise
    ]);

    await Promise.all([
      buildPublic(),
      validate()
    ]);

    printStats(stats);
  } catch (e) {
    console.trace(e);
    console.error('Something went wrong!');
    process.exit(1);
  }
})();

function printStats(stats: TaskResult[]): void {
  stats.sort((a, b) => a.start - b.start);

  const longestTaskName = Math.max(...stats.map(i => i.taskName.length));
  const realStart = Math.min(...stats.map(i => i.start));
  const realEnd = Math.max(...stats.map(i => i.end));

  const statsStep = ((realEnd - realStart) / 160) | 0;

  stats.forEach(stat => {
    console.log(
      `[${stat.taskName}]${' '.repeat(longestTaskName - stat.taskName.length)}`,
      ' '.repeat(((stat.start - realStart) / statsStep) | 0),
      '='.repeat(Math.max(((stat.end - stat.start) / statsStep) | 0, 1))
    );
  });
}
