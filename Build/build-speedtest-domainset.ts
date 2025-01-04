import path from 'node:path';

import tldts from 'tldts-experimental';
import { task } from './trace';
import { $fetch } from './lib/make-fetch-happen';
import { SHARED_DESCRIPTION } from './constants/description';
import { readFileIntoProcessedArray } from './lib/fetch-text-by-line';

import { DomainsetOutput } from './lib/create-file';
import { OUTPUT_SURGE_DIR, SOURCE_DIR } from './constants/dir';
import { newQueue } from '@henrygd/queue';

const KEYWORDS = [
  'Hong Kong',
  'Taiwan',
  'China Telecom',
  'China Mobile',
  'China Unicom',
  'Japan',
  'Tokyo',
  'Singapore',
  'Korea',
  'Seoul',
  'Canada',
  'Toronto',
  'Montreal',
  'Los Ang',
  'San Jos',
  'Seattle',
  'New York',
  'Dallas',
  'Miami',
  'Berlin',
  'Frankfurt',
  'London',
  'Paris',
  'Amsterdam',
  'Moscow',
  'Australia',
  'Sydney',
  'Brazil',
  'Turkey'
];

const s = newQueue(2);

const latestTopUserAgentsPromise = $fetch('https://raw.githubusercontent.com/microlinkhq/top-user-agents/master/src/desktop.json')
  .then(res => res.json())
  .then((userAgents: string[]) => userAgents.filter(ua => ua.startsWith('Mozilla/5.0 ')));

const getSpeedtestHostsGroupsPromise = Promise.all(KEYWORDS.flatMap(querySpeedtestApi));

export const buildSpeedtestDomainSet = task(require.main === module, __filename)(async (span) => {
  const output = new DomainsetOutput(span, 'speedtest')
    .withTitle('Sukka\'s Ruleset - Speedtest Domains')
    .withDescription([
      ...SHARED_DESCRIPTION,
      '',
      'This file contains common speedtest endpoints.'
    ])
    .addFromDomainset(await readFileIntoProcessedArray(path.resolve(SOURCE_DIR, 'domainset/speedtest.conf')))
    .addFromDomainset(
      (await readFileIntoProcessedArray(path.resolve(OUTPUT_SURGE_DIR, 'domainset/speedtest.conf')))
        .reduce<string[]>((acc, cur) => {
          const hn = tldts.getHostname(cur, { detectIp: false, validateHostname: true });
          if (hn) {
            acc.push(hn);
          }
          return acc;
        }, [])
    );

  const hostnameGroup = await span.traceChildPromise('get speedtest hosts groups', getSpeedtestHostsGroupsPromise);

  hostnameGroup.forEach(hostname => output.bulkAddDomain(hostname));
  await output.done();

  return output.write();
});

async function querySpeedtestApi(keyword: string) {
  const topUserAgents = await latestTopUserAgentsPromise;

  const url = `https://www.speedtest.net/api/js/servers?engine=js&search=${keyword}&limit=100`;

  try {
    const randomUserAgent = topUserAgents[Math.floor(Math.random() * topUserAgents.length)];

    const data = await s.add<Array<{ url: string, host: string }>>(() => $fetch(url, {
      headers: {
        dnt: '1',
        Referer: 'https://www.speedtest.net/',
        accept: 'application/json, text/plain, */*',
        'User-Agent': randomUserAgent,
        'Accept-Language': 'en-US,en;q=0.9',
        ...(randomUserAgent.includes('Chrome')
          ? {
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-origin',
            'Sec-Gpc': '1'
          }
          : {})
      },
      timeout: 1000 * 60
    }).then(res => res.json()));

    return data.reduce<string[]>(
      (prev, cur) => {
        const hn = tldts.getHostname(cur.host || cur.url, { detectIp: false, validateHostname: true });
        if (hn) {
          prev.push(hn);
        }
        return prev;
      },
      []
    );
  } catch (e) {
    console.error(e);
    return [];
  }
}
