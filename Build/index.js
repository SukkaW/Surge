// @ts-check

const { downloadPreviousBuild, downloadPublicSuffixList } = require('./download-previous-build');
const { buildCommon } = require('./build-common');
const { buildAntiBogusDomain } = require('./build-anti-bogus-domain');
const { buildAppleCdn } = require('./build-apple-cdn');
const { buildCdnConf } = require('./build-cdn-conf');
const { buildPhishingDomainSet } = require('./build-phishing-domainset');
const { buildRejectDomainSet } = require('./build-reject-domainset');
const { buildTelegramCIDR } = require('./build-telegram-cidr');
const { buildChnCidr } = require('./build-chn-cidr');
const { buildSpeedtestDomainSet } = require('./build-speedtest-domainset');
const { buildInternalCDNDomains } = require('./build-internal-cdn-rules');
const { buildInternalChnDomains } = require('./build-internal-chn-domains');
const { buildDomesticRuleset } = require('./build-domestic-ruleset');
const { validate } = require('./validate-domainset');

const { buildPublicHtml } = require('./build-public');

const { Worker } = require('jest-worker');

/**
 * @template T
 * @typedef {import('jest-worker').Worker & { __sukka_worker_name: string } & T} WithWorker
 */

/**
 * @template T
 * @param {string} path
 * @returns {WithWorker<T>}
 */
const requireWorker = (path) => {
  const _worker = /** @type {WithWorker<T>} */ (new Worker(
    require.resolve(path),
    {
      numWorkers: 1,
      maxRetries: 0,
      enableWorkerThreads: true
    }
  ));
  _worker.getStderr().pipe(process.stderr);
  _worker.getStdout().pipe(process.stdout);
  _worker.__sukka_worker_name = path;
  return _worker;
};

/**
 * @template T
 * @param {WithWorker<T>} worker
 */
const endWorker = async (worker) => {
  const { forceExited } = await worker.end();
  if (forceExited && worker.__sukka_worker_name) {
    console.log(worker.__sukka_worker_name, 'forceExited');
  }
};

(async () => {
  const buildInternalReverseChnCIDRWorker = /** @type {WithWorker<import('./build-internal-reverse-chn-cidr')>} */ (requireWorker('./build-internal-reverse-chn-cidr'));
  const { buildInternalReverseChnCIDR } = buildInternalReverseChnCIDRWorker;

  // download-previous-build
  const downloadPreviousBuildPromise = downloadPreviousBuild();
  const downloadPublicSuffixListPromise = downloadPublicSuffixList();
  // build:common
  const buildCommonPromise = downloadPreviousBuildPromise.then(() => buildCommon());
  // build:anti-bogus-domain
  const buildAntiBogusDomainPromise = downloadPreviousBuildPromise.then(() => buildAntiBogusDomain());
  // build:apple-cdn
  const buildAppleCdnPromise = downloadPreviousBuildPromise.then(() => buildAppleCdn());
  // build:cdn-conf
  const buildCdnConfPromise = Promise.all([
    downloadPreviousBuildPromise,
    downloadPublicSuffixListPromise
  ]).then(() => buildCdnConf());
  // build:phishing-domainset
  const buildPhilishingDomainsetPromise = Promise.all([
    downloadPreviousBuildPromise,
    downloadPublicSuffixListPromise
  ]).then(() => buildPhishingDomainSet());
  // build:reject-domainset
  const buildRejectDomainSetPromise = Promise.all([
    downloadPreviousBuildPromise,
    downloadPublicSuffixListPromise,
    buildPhilishingDomainsetPromise
  ]).then(() => buildRejectDomainSet());
  // build:telegram-cidr
  const buildTelegramCIDRPromise = downloadPreviousBuildPromise.then(() => buildTelegramCIDR());
  // build:chn-cidr
  const buildChnCidrPromise = downloadPreviousBuildPromise.then(() => buildChnCidr());
  // build:speedtest-domainset
  const buildSpeedtestDomainSetPromise = downloadPreviousBuildPromise.then(() => buildSpeedtestDomainSet());
  // build:internal-cdn-rules
  const buildInternalCDNDomainsPromise = Promise.all([
    downloadPublicSuffixListPromise,
    buildCommonPromise,
    buildCdnConfPromise
  ]).then(() => buildInternalCDNDomains());
  // build:internal-reverse-chn-cidr
  const buildInternalReverseChnCIDRPromise = buildInternalReverseChnCIDR();
  // build:internal-chn-domains
  const buildInternalChnDomainsPromise = buildInternalChnDomains();
  // build:domestic-ruleset
  const buildDomesticRulesetPromise = downloadPreviousBuildPromise.then(() => buildDomesticRuleset());

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
    buildInternalReverseChnCIDRPromise,
    buildInternalChnDomainsPromise,
    buildDomesticRulesetPromise
  ]);

  await Promise.all([
    buildPublicHtml(),
    validate(),
    endWorker(buildInternalReverseChnCIDRWorker)
  ]);

  printStats(stats);
})();

/**
 * @param {Array<{ start: number, end: number, taskName: string }>} stats
 */
function printStats(stats) {
  // sort stats by start time
  stats.sort((a, b) => a.start - b.start);

  const longestTaskName = Math.max(...stats.map(i => i.taskName.length));
  const realStart = Math.min(...stats.map(i => i.start));
  const realEnd = Math.max(...stats.map(i => i.end));

  const totalMs = realEnd - realStart;

  const statsStep = (totalMs / 160) | 0;

  stats.forEach(stat => {
    console.log(
      `[${stat.taskName}]${' '.repeat(longestTaskName - stat.taskName.length)}`,
      ' '.repeat(((stat.start - realStart) / statsStep) | 0),
      '='.repeat(Math.max(((stat.end - stat.start) / statsStep) | 0, 1))
    );
  });
}
