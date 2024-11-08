import path from 'node:path';

import { getHostname } from 'tldts-experimental';
import { task } from './trace';
import { $fetch } from './lib/make-fetch-happen';
import { SHARED_DESCRIPTION } from './lib/constants';
import { readFileIntoProcessedArray } from './lib/fetch-text-by-line';

import { DomainsetOutput } from './lib/create-file';
import { OUTPUT_SURGE_DIR } from './constants/dir';
import { createMemoizedPromise } from './lib/memo-promise';
import { Sema } from 'async-sema';

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

const PREDEFINE_DOMAINS = [
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
  '.speedtest.pni.tw',
  '.speedtest.cmcnetworks.net',
  '.speedtestwnet.com.br',
  // Cloudflare
  '.speed.cloudflare.com',
  // Wi-Fi Man
  '.wifiman.com',
  '.wifiman.me',
  '.wifiman.ubncloud.com',
  '.wifiman-stability-test.ubncloud.com',
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
  'open.cachefly.net' // This is also used for openspeedtest server download

];

const s = new Sema(2);

const latestTopUserAgentsPromise = $fetch('https://cdn.jsdelivr.net/npm/top-user-agents@latest/src/desktop.json')
  .then(res => res.json())
  .then((userAgents: string[]) => userAgents.filter(ua => ua.startsWith('Mozilla/5.0 ')));

async function querySpeedtestApi(keyword: string) {
  const topUserAgents = await latestTopUserAgentsPromise;

  const url = `https://www.speedtest.net/api/js/servers?engine=js&search=${keyword}&limit=100`;

  try {
    const randomUserAgent = topUserAgents[Math.floor(Math.random() * topUserAgents.length)];

    await s.acquire();

    const r = await $fetch(url, {
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
    });

    const data: Array<{ url: string, host: string }> = await r.json();

    return data.reduce<string[]>(
      (prev, cur) => {
        const hn = getHostname(cur.host || cur.url, { detectIp: false, validateHostname: true });
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
  } finally {
    s.release();
  }
}

const getSpeedtestHostsGroupsPromise = createMemoizedPromise(() => Promise.all(KEYWORDS.flatMap(querySpeedtestApi)));

export const buildSpeedtestDomainSet = task(require.main === module, __filename)(async (span) => {
  const output = new DomainsetOutput(span, 'speedtest')
    .withTitle('Sukka\'s Ruleset - Speedtest Domains')
    .withDescription([
      ...SHARED_DESCRIPTION,
      '',
      'This file contains common speedtest endpoints.'
    ])
    .addFromDomainset(PREDEFINE_DOMAINS)
    .addFromDomainset(await readFileIntoProcessedArray(path.resolve(OUTPUT_SURGE_DIR, 'domainset/speedtest.conf')));

  const hostnameGroup = await span.traceChildPromise('get speedtest hosts groups', getSpeedtestHostsGroupsPromise());

  hostnameGroup.forEach(hostname => output.bulkAddDomain(hostname));

  return output.write();
});
