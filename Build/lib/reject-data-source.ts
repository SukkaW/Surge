import { TTL } from './cache-filesystem';

export const HOSTS = [
  ['https://pgl.yoyo.org/adservers/serverlist.php?hostformat=hosts&showintro=0&mimetype=plaintext', true, TTL.THREE_HOURS()],
  ['https://someonewhocares.org/hosts/hosts', true, TTL.THREE_HOURS()],
  // no coin list is not actively maintained, but it updates daily when being maintained, so we set a 3 days cache ttl
  ['https://raw.githubusercontent.com/hoshsadiq/adblock-nocoin-list/master/hosts.txt', true, TTL.THREE_DAYS()],
  // have not been updated for more than a year, so we set a 14 days cache ttl
  ['https://raw.githubusercontent.com/crazy-max/WindowsSpyBlocker/master/data/hosts/spy.txt', true, TTL.TWO_WEEKS()],
  ['https://raw.githubusercontent.com/jerryn70/GoodbyeAds/master/Extension/GoodbyeAds-Xiaomi-Extension.txt', false, TTL.THREE_DAYS()],
  ['https://raw.githubusercontent.com/jerryn70/GoodbyeAds/master/Extension/GoodbyeAds-Huawei-AdBlock.txt', false, TTL.THREE_DAYS()],
  // ad-wars is not actively maintained, so we set a 7 days cache ttl
  ['https://raw.githubusercontent.com/jdlingyu/ad-wars/master/hosts', false, TTL.ONE_WEEK()],
  ['https://raw.githubusercontent.com/durablenapkin/block/master/luminati.txt', true, TTL.THREE_HOURS()],
  // Curben's UrlHaus Malicious URL Blocklist
  // 'https://curbengh.github.io/urlhaus-filter/urlhaus-filter-agh-online.txt',
  // 'https://urlhaus-filter.pages.dev/urlhaus-filter-agh-online.txt',
  ['https://curbengh.github.io/urlhaus-filter/urlhaus-filter-hosts.txt', true, TTL.THREE_HOURS()]
  // Curben's Phishing URL Blocklist
  // Covered by lib/get-phishing-domains.ts
  // 'https://curbengh.github.io/phishing-filter/phishing-filter-agh.txt'
  // 'https://phishing-filter.pages.dev/phishing-filter-agh.txt'
  // ['https://curbengh.github.io/phishing-filter/phishing-filter-hosts.txt', true, true],
] as const;

export const DOMAIN_LISTS = [
  // CoinBlockerList
  // Although the hosts file is still actively maintained, the hosts_browser file is not updated since 2021-07, so we set a 14 days cache ttl
  ['https://zerodot1.gitlab.io/CoinBlockerLists/list_browser.txt', true, TTL.TWO_WEEKS()],
  // BarbBlock
  // The barbblock list has never been updated since 2019-05, so we set a 14 days cache ttl
  ['https://paulgb.github.io/BarbBlock/blacklists/domain-list.txt', true, TTL.TWO_WEEKS()],
  // DigitalSide Threat-Intel - OSINT Hub
  // Update once per day
  ['https://osint.digitalside.it/Threat-Intel/lists/latestdomains.txt', true, TTL.ONE_DAY()],
  // Curben's PUP Domains Blocklist
  // 'https://curbengh.github.io/pup-filter/pup-filter-agh.txt'
  // 'https://pup-filter.pages.dev/pup-filter-agh.txt'
  // The PUP filter has paused the update since 2023-05, so we set a 14 days cache ttl
  ['https://curbengh.github.io/pup-filter/pup-filter-domains.txt', true, TTL.TWO_WEEKS()],
  // AdGuard CNAME Filter Combined
  // Update on a 7 days basis, so we add a 3 hours cache ttl
  ['https://raw.githubusercontent.com/AdguardTeam/cname-trackers/master/data/combined_disguised_ads_justdomains.txt', true, TTL.THREE_DAYS()],
  ['https://raw.githubusercontent.com/AdguardTeam/cname-trackers/master/data/combined_disguised_trackers_justdomains.txt', true, TTL.THREE_DAYS()],
  ['https://raw.githubusercontent.com/AdguardTeam/cname-trackers/master/data/combined_disguised_clickthroughs_justdomains.txt', true, TTL.THREE_DAYS()],
  ['https://raw.githubusercontent.com/AdguardTeam/cname-trackers/master/data/combined_disguised_microsites_justdomains.txt', true, TTL.THREE_DAYS()],
  ['https://raw.githubusercontent.com/AdguardTeam/cname-trackers/master/data/combined_disguised_mail_trackers_justdomains.txt', true, TTL.THREE_DAYS()]
] as const;

type AdGuardFilterSource = string | [main: string, mirrors: string[] | null, ttl: number];

export const ADGUARD_FILTERS: AdGuardFilterSource[] = [
  // EasyList
  [
    'https://easylist.to/easylist/easylist.txt',
    [
      'https://ublockorigin.github.io/uAssetsCDN/thirdparties/easylist.txt',
      'https://ublockorigin.pages.dev/thirdparties/easylist.txt',
      'https://easylist-downloads.adblockplus.org/easylist.txt',
      'https://raw.githubusercontent.com/easylist/easylist/gh-pages/easylist.txt',
      'https://secure.fanboy.co.nz/easylist.txt'
    ],
    TTL.TWLVE_HOURS()
  ],
  // EasyPrivacy
  [
    'https://easylist.to/easylist/easyprivacy.txt',
    [
      'https://secure.fanboy.co.nz/easyprivacy.txt',
      'https://raw.githubusercontent.com/easylist/easylist/gh-pages/easyprivacy.txt',
      'https://easylist-downloads.adblockplus.org/easyprivacy.txt',
      'https://ublockorigin.github.io/uAssetsCDN/thirdparties/easyprivacy.txt',
      'https://ublockorigin.pages.dev/thirdparties/easyprivacy.txt'
    ],
    TTL.TWLVE_HOURS()
  ],
  // AdGuard DNS Filter
  [
    'https://adguardteam.github.io/AdGuardSDNSFilter/Filters/filter.txt',
    [
      'https://filters.adtidy.org/extension/ublock/filters/15_optimized.txt',
      'https://adguardteam.github.io/HostlistsRegistry/assets/filter_1.txt'
    ],
    TTL.TWLVE_HOURS()
  ],
  // uBlock Origin Filter List
  [
    'https://ublockorigin.github.io/uAssetsCDN/filters/filters.min.txt',
    [
      'https://ublockorigin.pages.dev/filters/filters.min.txt'
    ],
    TTL.THREE_HOURS()
  ],
  // uBlock Origin Badware Risk List
  [
    'https://ublockorigin.github.io/uAssetsCDN/filters/badware.min.txt',
    [
      'https://ublockorigin.pages.dev/filters/badware.min.txt'
    ],
    TTL.THREE_HOURS()
  ],
  // uBlock Origin Privacy List
  [
    'https://ublockorigin.github.io/uAssetsCDN/filters/privacy.min.txt',
    [
      'https://ublockorigin.pages.dev/filters/privacy.min.txt'
    ],
    TTL.THREE_HOURS()
  ],
  // uBlock Origin Resource Abuse: merged in uBlock Origin Privacy List
  // [
  //   'https://ublockorigin.github.io/uAssetsCDN/filters/resource-abuse.txt',
  //   [
  //     'https://ublockorigin.pages.dev/filters/resource-abuse.txt'
  //   ]
  // ],
  // uBlock Origin Unbreak
  [
    'https://ublockorigin.github.io/uAssetsCDN/filters/unbreak.min.txt',
    [
      'https://ublockorigin.pages.dev/filters/unbreak.min.txt'
    ],
    TTL.THREE_HOURS()
  ],
  // AdGuard Base Filter
  ['https://filters.adtidy.org/extension/ublock/filters/2_without_easylist.txt', null, TTL.THREE_HOURS()],
  // AdGuard Mobile AD
  ['https://filters.adtidy.org/extension/ublock/filters/11_optimized.txt', null, TTL.THREE_HOURS()],
  // AdGuard Tracking Protection
  ['https://filters.adtidy.org/extension/ublock/filters/3_optimized.txt', null, TTL.THREE_HOURS()],
  // AdGuard Japanese filter
  ['https://filters.adtidy.org/extension/ublock/filters/7_optimized.txt', null, TTL.THREE_HOURS()],
  // AdGuard Chinese filter (EasyList China + AdGuard Chinese filter)
  ['https://filters.adtidy.org/extension/ublock/filters/224_optimized.txt', null, TTL.THREE_HOURS()],
  // AdGuard Annoyances filter
  ['https://filters.adtidy.org/android/filters/14_optimized.txt', null, TTL.THREE_HOURS()],
  // EasyList Germany filter
  [
    'https://easylist.to/easylistgermany/easylistgermany.txt',
    [
      'https://easylist-downloads.adblockplus.org/easylistgermany.txt'
    ],
    TTL.TWLVE_HOURS()
  ],
  // GameConsoleAdblockList
  // Update almost once per 1 to 3 months, let's set a 10 days cache ttl
  ['https://raw.githubusercontent.com/DandelionSprout/adfilt/master/GameConsoleAdblockList.txt', null, TTL.TEN_DAYS()],
  // PiHoleBlocklist
  // Update almost once per 3 months, let's set a 10 days cache ttl
  [
    'https://perflyst.github.io/PiHoleBlocklist/SmartTV-AGH.txt',
    [
      'https://raw.githubusercontent.com/Perflyst/PiHoleBlocklist/master/SmartTV-AGH.txt'
    ],
    TTL.TEN_DAYS()
  ],
  // Spam404
  // Not actively maintained, let's use a 10 days cache ttl
  ['https://raw.githubusercontent.com/Spam404/lists/master/adblock-list.txt', null, TTL.TEN_DAYS()],
  // Brave First Party & First Party CNAME
  ['https://raw.githubusercontent.com/brave/adblock-lists/master/brave-lists/brave-firstparty.txt', null, TTL.ONE_DAY()]
] as const;

export const PREDEFINED_WHITELIST = [
  'localhost',
  'local',
  'localhost.localdomain',
  'broadcasthost',
  'ip6-loopback',
  'ip6-localnet',
  'ip6-mcastprefix',
  'ip6-allnodes',
  'ip6-allrouters',
  'ip6-allhosts',
  'mcastprefix',
  'skk.moe',
  'analytics.google.com',
  'cloud.answerhub.com',
  'ae01.alicdn.com',
  'whoami.akamai.net',
  'whoami.ds.akahelp.net',
  'pxlk9.net.', // This one is malformed from EasyList, which I will manually add instead
  'instant.page', // No, it doesn't violate anyone's privacy. I will whitelist it
  'piwik.pro',
  'mixpanel.com',
  'cdn.mxpnl.com',
  'heapanalytics.com',
  'segment.com',
  'segmentify.com',
  't.co', // pgl yoyo add t.co to the blacklist
  'survicate.com', // AdGuardDNSFilter
  'perfops.io', // AdGuardDNSFilter
  'd2axgrpnciinw7.cloudfront.net', // ADGuardDNSFilter
  'tb-lb.sb-cd.com', // AdGuard
  'storage.yandexcloud.net', // phishing list
  'login.microsoftonline.com', // phishing list
  'api.xiaomi.com', // https://github.com/jerryn70/GoodbyeAds/issues/281
  'api.io.mi.com', // https://github.com/jerryn70/GoodbyeAds/issues/281
  'cdn.userreport.com', // https://github.com/AdguardTeam/AdGuardSDNSFilter/issues/1158
  'ip-api.com',
  'fastly-analytics.com',
  'syd1.digitaloceanspaces.com',
  's3.nl-ams.scw.cloud',
  'geolocation-db.com',
  'uploads.codesandbox.io',
  // Affect Windows ISO download
  // https://raw.githubusercontent.com/AdguardTeam/cname-trackers/master/data/combined_disguised_trackers.txt
  'vlscppe.microsoft.com',
  // OpenAI use this for A/B testing
  // Fuck Peter Lowe Hosts
  'pstmrk.it'
];

export const PREDEFINED_ENFORCED_WHITELIST = [
  'godaddysites.com',
  'web.app',
  'firebaseapp.com',
  'ipfs.nftstorage.link',
  'ipfs.4everland.io',
  'ipfs.cf-ipfs.com',
  'ipfs.dweb.link',
  'ipfs.infura-ipfs.io',
  'ipfs.fleek.cool',
  'repl.co',
  'w3s.link',
  'translate.goog',
  'backblazeb2.com',
  'workers.dev',
  'r2.dev',
  'glitch.me',
  'netlify.app',
  'blogspot.com',
  'appspot.com'
];
