const { fetch } = require('undici');
const { domainDeduper } = require('./lib/domain-deduper');
const path = require('path');
const { createRuleset } = require('./lib/create-file');
const domainSorter = require('./lib/stable-sort-domain');

const { Sema } = require('async-sema');
const { task } = require('./lib/trace-runner');
const s = new Sema(2);

/**
 * @param {string} keyword
 * @returns {string[]}
 */
const querySpeedtestApi = async (keyword) => {
  await s.acquire();

  try {
    const res = await fetch(`https://www.speedtest.net/api/js/servers?engine=js&search=${keyword}&limit=100`, {
      headers: {
        dnt: '1',
        Referer: 'https://www.speedtest.net/',
        accept: 'application/json, text/plain, */*',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Sec-Ch-Ua': '"Not/A)Brand";v="99", "Google Chrome";v="115", "Chromium";v="115"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Gpc': '1'
      }
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text);
    }

    /** @type {{ url: string }[]} */
    const json = await res.json();
    s.release();
    return json.map(({ url }) => new URL(url).hostname);
  } catch (e) {
    s.release();
    console.log(e);
  }
};

const buildSpeedtestDomainSet = task(__filename, async () => {
  /** @type {Set<string>} */
  const domains = new Set([
    '.speedtest.net',
    '.ooklaserver.net',
    '.speed.misaka.one',
    'speed.cloudflare.com',
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
    '.linknetspeedtest.net.br'
  ]);

  const hostnameGroups = await Promise.all([
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
  ].map(querySpeedtestApi));

  for (const hostnames of hostnameGroups) {
    if (Array.isArray(hostnames)) {
      for (const hostname of hostnames) {
        domains.add(hostname);
      }
    }
  }

  const deduped = domainDeduper(Array.from(domains)).sort(domainSorter);
  const description = [
    'License: AGPL 3.0',
    'Homepage: https://ruleset.skk.moe',
    'GitHub: https://github.com/SukkaW/Surge'
  ];

  return Promise.all(createRuleset(
    'Sukka\'s Ruleset - Speedtest Domains',
    description,
    new Date(),
    deduped,
    'domainset',
    path.resolve(__dirname, '../List/domainset/speedtest.conf'),
    path.resolve(__dirname, '../Clash/domainset/speedtest.txt')
  ));
});

module.exports.buildSpeedtestDomainSet = buildSpeedtestDomainSet;

if (require.main === module) {
  buildSpeedtestDomainSet();
}
