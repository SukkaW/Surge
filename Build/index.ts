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

import { Worker } from 'jest-worker';

type WithWorker<T> = import('jest-worker').Worker & { __sukka_worker_name: string } & T

const requireWorker = <T>(path: string): WithWorker<T> => {
  const _worker = new Worker(
    require.resolve(path),
    {
      numWorkers: 1,
      maxRetries: 0,
      enableWorkerThreads: true
    }
  ) as WithWorker<T>;
  _worker.getStderr().pipe(process.stderr);
  _worker.getStdout().pipe(process.stdout);
  _worker.__sukka_worker_name = path;
  return _worker;
};

const endWorker = async <T>(worker: WithWorker<T>) => {
  const { forceExited } = await worker.end();
  if (forceExited && worker.__sukka_worker_name) {
    console.log(worker.__sukka_worker_name, 'forceExited');
  }
};

(async () => {
  const buildInternalReverseChnCIDRWorker: WithWorker<typeof import('./build-internal-reverse-chn-cidr')> = requireWorker('./build-internal-reverse-chn-cidr');
  const { buildInternalReverseChnCIDR } = buildInternalReverseChnCIDRWorker;

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
  const buildInternalReverseChnCIDRPromise = buildInternalReverseChnCIDR();
  const buildInternalChnDomainsPromise = buildInternalChnDomains();
  const buildDomesticRulesetPromise = downloadPreviousBuildPromise.then(() => buildDomesticRuleset());

  const buildRedirectModulePromise = downloadPreviousBuildPromise.then(() => buildRedirectModule());
  const buildStreamServicePromise = downloadPreviousBuildPromise.then(() => buildStreamService());

  const stats: Array<{ start: number, end: number, taskName: string }> = await Promise.all([
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
    buildInternalReverseChnCIDRPromise,
    buildInternalChnDomainsPromise,
    buildDomesticRulesetPromise,
    buildRedirectModulePromise,
    buildStreamServicePromise
  ]);

  await Promise.all([
    buildPublicHtml(),
    validate(),
    endWorker(buildInternalReverseChnCIDRWorker)
  ]);

  printStats(stats);
})();

function printStats(stats: Array<{ start: number, end: number, taskName: string }>): void {
  stats.sort((a, b) => a.start - b.start);

  const longestTaskName: number = Math.max(...stats.map(i => i.taskName.length));
  const realStart: number = Math.min(...stats.map(i => i.start));
  const realEnd: number = Math.max(...stats.map(i => i.end));

  const totalMs: number = realEnd - realStart;

  const statsStep: number = (totalMs / 160) | 0;

  stats.forEach(stat => {
    console.log(
      `[${stat.taskName}]${' '.repeat(longestTaskName - stat.taskName.length)}`,
      ' '.repeat(((stat.start - realStart) / statsStep) | 0),
      '='.repeat(Math.max(((stat.end - stat.start) / statsStep) | 0, 1))
    );
  });
}
