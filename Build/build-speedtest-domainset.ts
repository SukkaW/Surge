import { domainDeduper } from './lib/domain-deduper';
import path from 'path';
import { createRuleset } from './lib/create-file';
import { sortDomains } from './lib/stable-sort-domain';

import { Sema } from 'async-sema';
import { getHostname } from 'tldts';
import { task } from './trace';
import { fetchWithRetry } from './lib/fetch-retry';
import { SHARED_DESCRIPTION } from './lib/constants';
import picocolors from 'picocolors';
import { fetchRemoteTextByLine } from './lib/fetch-text-by-line';
import { processLine } from './lib/process-line';
import { TTL, deserializeArray, fsFetchCache, serializeArray } from './lib/cache-filesystem';
import { createMemoizedPromise } from './lib/memo-promise';

import { setAddFromArrayCurried } from './lib/set-add-from-array';

const s = new Sema(2);

const latestTopUserAgentsPromise = fsFetchCache.apply(
  'https://cdn.jsdelivr.net/npm/top-user-agents@latest/src/desktop.json',
  () => fetchWithRetry('https://cdn.jsdelivr.net/npm/top-user-agents@latest/src/desktop.json')
    .then(res => res.json() as any)
    .then((userAgents: string[]) => userAgents.filter(ua => ua.startsWith('Mozilla/5.0 '))),
  {
    serializer: serializeArray,
    deserializer: deserializeArray,
    ttl: TTL.THREE_DAYS()
  }
);

const querySpeedtestApi = async (keyword: string): Promise<Array<string | null>> => {
  const topUserAgents = await latestTopUserAgentsPromise;

  const url = `https://www.speedtest.net/api/js/servers?engine=js&search=${keyword}&limit=100`;

  try {
    const randomUserAgent = topUserAgents[Math.floor(Math.random() * topUserAgents.length)];

    return await fsFetchCache.apply(
      url,
      () => s.acquire().then(() => fetchWithRetry(url, {
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
      })).then(r => r.json() as any).then((data: Array<{ url: string }>) => data.reduce<string[]>(
        (prev, cur) => {
          const hn = getHostname(cur.url, { detectIp: false });
          if (hn) {
            prev.push(hn);
          }
          return prev;
        }, []
      )).finally(() => s.release()),
      {
        ttl: TTL.ONE_WEEK(),
        serializer: serializeArray,
        deserializer: deserializeArray
      }
    );
  } catch (e) {
    console.error(e);
    return [];
  }
};

const getPreviousSpeedtestDomainsPromise = createMemoizedPromise(async () => {
  const domains: string[] = [];
  for await (const l of await fetchRemoteTextByLine('https://ruleset.skk.moe/List/domainset/speedtest.conf')) {
    const line = processLine(l);
    if (line) {
      domains.push(line);
    }
  }
  return domains;
});

export const buildSpeedtestDomainSet = task(import.meta.main, import.meta.path)(async (span) => {
  // Predefined domainset
  /** @type {Set<string>} */
  const domains = new Set<string>([
    // speedtest.net
    '.speedtest.net',
    '.speedtestcustom.com',
    '.ooklaserver.net',
    '.speed.misaka.one',
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
    '.ookla-speedtest.fsr.com',
    '.speedtest.comnet.com.tr',
    '.speedtest.gslnetworks.com.au',
    '.test.gslnetworks.com.au',
    '.speedtest.gslnetworks.com',
    '.speedtestunonet.com.br',
    '.speedtest.alagas.net',
    'speedtest.surfshark.com',
    '.speedtest.aarnet.net.au',
    '.ookla.rcp.net',
    '.ookla-speedtests.e2ro.com',
    '.speedtest.com.sg',
    '.ookla.ddnsgeek.com',
    // Cloudflare
    '.speed.cloudflare.com',
    // Wi-Fi Man
    '.wifiman.com',
    '.wifiman.me',
    '.wifiman.ubncloud.com',
    // Fast.com
    '.fast.com',
    // MacPaw
    'speedtest.macpaw.com',
    // speedtestmaster
    '.netspeedtestmaster.com',
    // Google Search Result of "speedtest", powered by this
    '.measurement-lab.org',
    '.measurementlab.net',
    // Google Fiber legacy speedtest site (new fiber speedtest use speedtestcustom.com)
    '.speed.googlefiber.net',
    // librespeed
    '.backend.librespeed.org',
    // Apple,
    'mensura.cdn-apple.com', // From netQuality command
    // OpenSpeedtest
    'open.cachefly.net'
  ]);

  await span.traceChildAsync(
    'fetch previous speedtest domainset',
    () => getPreviousSpeedtestDomainsPromise()
      .then(setAddFromArrayCurried(domains))
  );

  await new Promise<void>((resolve) => {
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
    ]).reduce<Record<string, Promise<void>>>((pMap, keyword) => {
      pMap[keyword] = span.traceChildAsync(`fetch speedtest endpoints: ${keyword}`, () => querySpeedtestApi(keyword)).then(hostnameGroup => {
        hostnameGroup.forEach(hostname => {
          if (hostname) {
            domains.add(hostname);
          }
        });
      });

      return pMap;
    }, {});

    const timer = setTimeout(() => {
      console.error(picocolors.red('Task timeout!'));
      Object.entries(pMap).forEach(([name, p]) => {
        console.log(`[${name}]`, Bun.peek.status(p));
      });

      resolve();
    }, 1000 * 60 * 1.5);

    Promise.all(Object.values(pMap)).then(() => {
      clearTimeout(timer);
      resolve();
    });
  });

  const deduped = span.traceChildSync('sort result', () => sortDomains(domainDeduper(Array.from(domains))));

  const description = [
    ...SHARED_DESCRIPTION,
    '',
    'This file contains common speedtest endpoints.'
  ];

  return createRuleset(
    span,
    'Sukka\'s Ruleset - Speedtest Domains',
    description,
    new Date(),
    deduped,
    'domainset',
    path.resolve(import.meta.dir, '../List/domainset/speedtest.conf'),
    path.resolve(import.meta.dir, '../Clash/domainset/speedtest.txt')
  );
});
