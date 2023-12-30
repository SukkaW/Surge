import { domainDeduper } from './lib/domain-deduper';
import path from 'path';
import { createRuleset } from './lib/create-file';
import { sortDomains } from './lib/stable-sort-domain';

import { Sema } from 'async-sema';
import * as tldts from 'tldts';
import { task } from './lib/trace-runner';
import { fetchWithRetry } from './lib/fetch-retry';
import { SHARED_DESCRIPTION } from './lib/constants';
import { getGorhillPublicSuffixPromise } from './lib/get-gorhill-publicsuffix';
import picocolors from 'picocolors';
import { fetchRemoteTextByLine } from './lib/fetch-text-by-line';
import { processLine } from './lib/process-line';

const s = new Sema(2);

const latestTopUserAgentsPromise = fetchWithRetry('https://unpkg.com/top-user-agents@latest/index.json')
  .then(res => res.json<string[]>());

const querySpeedtestApi = async (keyword: string): Promise<Array<string | null>> => {
  const topUserAgents = (await Promise.all([
    latestTopUserAgentsPromise,
    s.acquire()
  ]))[0];

  try {
    const randomUserAgent = topUserAgents[Math.floor(Math.random() * topUserAgents.length)];
    const key = `fetch speedtest endpoints: ${keyword}`;
    console.log(key);
    console.time(key);

    const res = await fetchWithRetry(`https://www.speedtest.net/api/js/servers?engine=js&search=${keyword}&limit=100`, {
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
      signal: AbortSignal.timeout(1000 * 4),
      retry: {
        retries: 2
      }
    });

    const json = await res.json<Array<{ url: string }>>();

    console.timeEnd(key);

    return json.map(({ url }) => tldts.getHostname(url, { detectIp: false }));
  } catch (e) {
    console.log(e);
    return [];
  } finally {
    s.release();
  }
};

export const buildSpeedtestDomainSet = task(import.meta.path, async () => {
  // Predefined domainset
  /** @type {Set<string>} */
  const domains = new Set<string>([
    '.speedtest.net',
    '.speedtestcustom.com',
    '.ooklaserver.net',
    '.speed.misaka.one',
    '.speed.cloudflare.com',
    '.speedtest.rt.ru',
    '.speedtest.aptg.com.tw',
    '.speedtest.gslnetworks.com',
    '.speedtest.jsinfo.net',
    '.speedtest.i3d.net',
    '.speedtestkorea.com',
    '.speedtest.telus.com',
    '.speedtest.telstra.net',
    '.speedtest.clouvider.net',
    '.speedtest.idv.tw',
    '.speedtest.frontier.com',
    '.speedtest.orange.fr',
    '.speedtest.centurylink.net',
    '.srvr.bell.ca',
    '.speedtest.contabo.net',
    'speedtest.hk.chinamobile.com',
    'speedtestbb.hk.chinamobile.com',
    '.hizinitestet.com',
    '.linknetspeedtest.net.br',
    'speedtest.rit.edu',
    'speedtest.ropa.de',
    'speedtest.sits.su',
    'speedtest.tigo.cr',
    'speedtest.upp.com',
    '.speedtest.pni.tw',
    '.speed.pfm.gg',
    '.speedtest.faelix.net',
    '.speedtest.labixe.net',
    '.speedtest.warian.net',
    '.speedtest.starhub.com',
    '.speedtest.gibir.net.tr',
    '.speedtest.ozarksgo.net',
    '.speedtest.exetel.com.au',
    '.speedtest.sbcglobal.net',
    '.speedtest.leaptel.com.au',
    '.speedtest.windstream.net',
    '.speedtest.vodafone.com.au',
    '.speedtest.rascom.ru',
    '.speedtest.dchost.com',
    '.speedtest.highnet.com',
    '.speedtest.seattle.wa.limewave.net',
    '.speedtest.optitel.com.au',
    '.speednet.net.tr',
    '.speedtest.angolacables.co.ao',
    // Fast.com
    '.fast.com',
    // MacPaw
    'speedtest.macpaw.com',
    // speedtestmaster
    '.netspeedtestmaster.com',
    // Google Search Result of "speedtest", powered by this
    '.measurement-lab.org',
    // Google Fiber legacy speedtest site (new fiber speedtest use speedtestcustom.com)
    '.speed.googlefiber.net',
    // librespeed
    '.backend.librespeed.org'
  ]);

  // Download previous speedtest domainset
  for await (const l of await fetchRemoteTextByLine('https://ruleset.skk.moe/List/domainset/speedtest.conf')) {
    const line = processLine(l);
    if (line) {
      domains.add(line);
    }
  }

  let timer;

  const pMap = ([
    'Hong Kong',
    'Taiwan',
    'China Telecom',
    'China Mobile',
    'China Unicom',
    'Japan',
    'Tokyo',
    'Singapore',
    'Korea',
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
  ]).reduce<Record<string, Promise<void>>>((pMap, keyword) => {
    pMap[keyword] = querySpeedtestApi(keyword).then(hostnameGroup => {
      hostnameGroup.forEach(hostname => {
        if (hostname) {
          domains.add(hostname);
        }
      });
    });

    return pMap;
  }, {});

  try {
    timer = setTimeout(() => {
      console.error(picocolors.red('Task timeout!'));
      Object.entries(pMap).forEach(([name, p]) => {
        console.log(`[${name}]`, Bun.peek.status(p));
      });

      throw new Error('timeout');
    }, 1000 * 60 * 2);

    await Promise.all(Object.values(pMap));
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }

  const gorhill = await getGorhillPublicSuffixPromise();
  const deduped = sortDomains(domainDeduper(Array.from(domains)), gorhill);

  const description = [
    ...SHARED_DESCRIPTION,
    '',
    'This file contains common speedtest endpoints.'
  ];

  return Promise.all(createRuleset(
    'Sukka\'s Ruleset - Speedtest Domains',
    description,
    new Date(),
    deduped,
    'domainset',
    path.resolve(import.meta.dir, '../List/domainset/speedtest.conf'),
    path.resolve(import.meta.dir, '../Clash/domainset/speedtest.txt')
  ));
});

if (import.meta.main) {
  buildSpeedtestDomainSet();
}
