// @ts-check
import path from 'path';
import { isIPv4, isIPv6 } from 'net';
import { createRuleset } from './lib/create-file';
import { fetchRemoteTextAndCreateReadlineInterface, readFileByLine } from './lib/fetch-remote-text-by-line';
import { processLine } from './lib/process-line';
import { task } from './lib/trace-runner';
import { SHARED_DESCRIPTION } from './lib/constants';

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

export const buildAntiBogusDomain = task(import.meta.path, async () => {
  const bogusIpPromise = getBogusNxDomainIPs();

  /** @type {string[]} */
  const result = [];
  for await (const line of readFileByLine(path.resolve(import.meta.dir, '../Source/ip/reject.conf'))) {
    if (line === '# --- [Anti Bogus Domain Replace Me] ---') {
      // bogus ip is less than 200, no need to worry about "Maximum call stack size exceeded"
      result.push(...(await bogusIpPromise));
      continue;
    } else {
      const l = processLine(line);
      if (l) {
        result.push(l);
      }
    }
  }

  const description = [
    ...SHARED_DESCRIPTION,
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
    path.resolve(import.meta.dir, '../List/ip/reject.conf'),
    path.resolve(import.meta.dir, '../Clash/ip/reject.txt')
  ));
});

if (import.meta.main) {
  buildAntiBogusDomain();
}
