import { downloadPreviousBuild, downloadPublicSuffixList } from './download-previous-build';
import { buildCommon } from './build-common';
import { buildAntiBogusDomain } from './build-anti-bogus-domain';
import { buildAppleCdn } from './build-apple-cdn';
import { buildCdnConf } from './build-cdn-conf';
import { buildPhishingDomainSet } from './build-phishing-domainset';
import { buildRejectDomainSet } from './build-reject-domainset';
import { buildTelegramCIDR } from './build-telegram-cidr';
import { buildChnCidr } from './build-chn-cidr';
import { buildSpeedtestDomainSet } from './build-speedtest-domainset';
import { buildInternalCDNDomains } from './build-internal-cdn-rules';
import { buildInternalChnDomains } from './build-internal-chn-domains';
import { buildDomesticRuleset } from './build-domestic-ruleset';
import { buildStreamService } from './build-stream-service';
import { buildRedirectModule } from './build-redirect-module';
import { validate } from './validate-domainset';

import { buildPublicHtml } from './build-public';
// import type { TaskResult } from './lib/trace-runner';

(async () => {
  console.log('Bun version:', Bun.version);

  try {
    // TODO: restore this once Bun has fixed their worker
    // const buildInternalReverseChnCIDRWorker = new Worker(new URL('./workers/build-internal-reverse-chn-cidr-worker.ts', import.meta.url));

    const downloadPreviousBuildPromise = downloadPreviousBuild();
    const downloadPublicSuffixListPromise = downloadPublicSuffixList();
    const buildCommonPromise = downloadPreviousBuildPromise.then(() => buildCommon());
    const buildAntiBogusDomainPromise = downloadPreviousBuildPromise.then(() => buildAntiBogusDomain());
    const buildAppleCdnPromise = downloadPreviousBuildPromise.then(() => buildAppleCdn());
    const buildCdnConfPromise = Promise.all([
      downloadPreviousBuildPromise,
      downloadPublicSuffixListPromise
    ]).then(() => buildCdnConf());
    const buildPhilishingDomainsetPromise = Promise.all([
      downloadPreviousBuildPromise,
      downloadPublicSuffixListPromise
    ]).then(() => buildPhishingDomainSet());
    const buildRejectDomainSetPromise = Promise.all([
      downloadPreviousBuildPromise,
      downloadPublicSuffixListPromise,
      buildPhilishingDomainsetPromise
    ]).then(() => buildRejectDomainSet());
    const buildTelegramCIDRPromise = downloadPreviousBuildPromise.then(() => buildTelegramCIDR());
    const buildChnCidrPromise = downloadPreviousBuildPromise.then(() => buildChnCidr());
    const buildSpeedtestDomainSetPromise = downloadPreviousBuildPromise.then(() => buildSpeedtestDomainSet());
    const buildInternalCDNDomainsPromise = Promise.all([
      downloadPublicSuffixListPromise,
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

    const buildInternalChnDomainsPromise = buildInternalChnDomains();
    const buildDomesticRulesetPromise = downloadPreviousBuildPromise.then(() => buildDomesticRuleset());

    const buildRedirectModulePromise = downloadPreviousBuildPromise.then(() => buildRedirectModule());
    const buildStreamServicePromise = downloadPreviousBuildPromise.then(() => buildStreamService());

    const stats = await Promise.all([
      downloadPreviousBuildPromise,
      downloadPublicSuffixListPromise,
      buildCommonPromise,
      buildAntiBogusDomainPromise,
      buildAppleCdnPromise,
      buildCdnConfPromise,
      buildPhilishingDomainsetPromise,
      buildRejectDomainSetPromise,
      buildTelegramCIDRPromise,
      buildChnCidrPromise,
      buildSpeedtestDomainSetPromise,
      buildInternalCDNDomainsPromise,
      // buildInternalReverseChnCIDRPromise,
      buildInternalChnDomainsPromise,
      buildDomesticRulesetPromise,
      buildRedirectModulePromise,
      buildStreamServicePromise
    ]);

    await Promise.all([
      buildPublicHtml(),
      validate()
    ]);

    printStats(stats);
  } catch (e) {
    console.error(e);
    console.error('Something went wrong!')
  }
})();

function printStats(stats: Array<{ start: number, end: number, taskName: string }>): void {
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
