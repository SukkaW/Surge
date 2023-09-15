// @ts-check
const path = require('path');
const { isIPv4, isIPv6 } = require('net');
const { createRuleset } = require('./lib/create-file');
const { fetchRemoteTextAndCreateReadlineInterface, readFileByLine } = require('./lib/fetch-remote-text-by-line');
const { processLine } = require('./lib/process-line');
const { task } = require('./lib/trace-runner');

const getBogusNxDomainIPs = async () => {
  /** @type {string[]} */
  const result = [];
  for await (const line of await fetchRemoteTextAndCreateReadlineInterface('https://raw.githubusercontent.com/felixonmars/dnsmasq-china-list/master/bogus-nxdomain.china.conf')) {
    if (line.startsWith('bogus-nxdomain=')) {
      const ip = line.slice(15).trim();
      if (isIPv4(ip)) {
        result.push(`IP-CIDR,${ip}/32,no-resolve`);
      } else if (isIPv6(ip)) {
        result.push(`IP-CIDR6,${ip}/128,no-resolve`);
      }
    }
  }
  return result;
};

const buildAntiBogusDomain = task(__filename, async () => {
  const filePath = path.resolve(__dirname, '../Source/ip/reject.conf');

  const bogusIpPromise = getBogusNxDomainIPs();

  /** @type {string[]} */
  const result = [];
  for await (const line of readFileByLine(filePath)) {
    if (line === '# --- [Anti Bogus Domain Replace Me] ---') {
      (await bogusIpPromise).forEach(rule => result.push(rule));
      continue;
    } else {
      const l = processLine(line);
      if (l) {
        result.push(l);
      }
    }
  }

  const description = [
    'License: AGPL 3.0',
    'Homepage: https://ruleset.skk.moe',
    'GitHub: https://github.com/SukkaW/Surge',
    '',
    'This file contains known addresses that are hijacking NXDOMAIN results returned by DNS servers.',
    '',
    'Data from:',
    ' - https://github.com/felixonmars/dnsmasq-china-list'
  ];

  return Promise.all(createRuleset(
    'Sukka\'s Ruleset - Anti Bogus Domain',
    description,
    new Date(),
    result,
    'ruleset',
    path.resolve(__dirname, '../List/ip/reject.conf'),
    path.resolve(__dirname, '../Clash/ip/reject.txt')
  ));
});

module.exports.buildAntiBogusDomain = buildAntiBogusDomain;

if (require.main === module) {
  buildAntiBogusDomain();
}
