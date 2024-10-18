import { TTL } from '../lib/cache-filesystem';

type HostsSource = [main: string, mirrors: string[] | null, includeAllSubDomain: boolean, ttl: number];

export const HOSTS: HostsSource[] = [
  // have not been updated for more than a year, so we set a 14 days cache ttl
  ['https://raw.githubusercontent.com/crazy-max/WindowsSpyBlocker/master/data/hosts/spy.txt', null, true, TTL.TWO_WEEKS()],
  ['https://raw.githubusercontent.com/jerryn70/GoodbyeAds/master/Extension/GoodbyeAds-Xiaomi-Extension.txt', null, false, TTL.ONE_WEEK()],
  ['https://raw.githubusercontent.com/jerryn70/GoodbyeAds/master/Extension/GoodbyeAds-Huawei-AdBlock.txt', null, false, TTL.ONE_WEEK()],
  ['https://raw.githubusercontent.com/durablenapkin/block/master/luminati.txt', null, true, TTL.THREE_HOURS()],
  ['https://raw.githubusercontent.com/durablenapkin/block/master/tvstream.txt', null, true, TTL.THREE_HOURS()]
];

export const HOSTS_EXTRA: HostsSource[] = [
  // This stupid hosts blocks t.co, so we determine that this is also bullshit, so it is also extra
  [
    'https://pgl.yoyo.org/adservers/serverlist.php?hostformat=hosts&showintro=0&mimetype=plaintext',
    ['https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/thirdparties/pgl.yoyo.org/as/serverlist'],
    true,
    TTL.THREE_HOURS()
  ],
  // Dan Pollock's hosts file, 0.0.0.0 version is 30 KiB smaller
  ['https://someonewhocares.org/hosts/zero/hosts', null, true, TTL.THREE_HOURS()],
  // ad-wars is not actively maintained, so we set a 7 days cache ttl
  ['https://raw.githubusercontent.com/jdlingyu/ad-wars/master/hosts', null, false, TTL.TWO_WEEKS()]
];

export const DOMAIN_LISTS: HostsSource[] = [
  // CoinBlockerList
  // Although the hosts file is still actively maintained, the hosts_browser file is not updated since 2021-07, so we set a 14 days cache ttl
  ['https://zerodot1.gitlab.io/CoinBlockerLists/list_browser.txt', [], true, TTL.TWO_WEEKS()]
];

export const DOMAIN_LISTS_EXTRA: HostsSource[] = [
  // BarbBlock
  // The barbblock list has never been updated since 2019-05, so we set a 14 days cache ttl
  [
    'https://paulgb.github.io/BarbBlock/blacklists/domain-list.txt',
    ['https://raw.githubusercontent.com/paulgb/BarbBlock/refs/heads/main/blacklists/domain-list.txt'],
    true,
    TTL.TWO_WEEKS()
  ],
  // DigitalSide Threat-Intel - OSINT Hub
  // Update once per day
  ['https://osint.digitalside.it/Threat-Intel/lists/latestdomains.txt', [], true, TTL.ONE_DAY()],
  // AdGuard CNAME Filter Combined
  // Update on a 7 days basis, so we add a 3 hours cache ttl
  ['https://raw.githubusercontent.com/AdguardTeam/cname-trackers/master/data/combined_disguised_ads_justdomains.txt', [], true, TTL.THREE_DAYS()],
  ['https://raw.githubusercontent.com/AdguardTeam/cname-trackers/master/data/combined_disguised_trackers_justdomains.txt', [], true, TTL.THREE_DAYS()],
  ['https://raw.githubusercontent.com/AdguardTeam/cname-trackers/master/data/combined_disguised_clickthroughs_justdomains.txt', [], true, TTL.THREE_DAYS()],
  ['https://raw.githubusercontent.com/AdguardTeam/cname-trackers/master/data/combined_disguised_microsites_justdomains.txt', [], true, TTL.THREE_DAYS()],
  // ['https://raw.githubusercontent.com/AdguardTeam/cname-trackers/master/data/combined_disguised_mail_trackers_justdomains.txt', [], true, TTL.THREE_DAYS()],
  // Curben's PUP Domains Blocklist
  // The PUP filter has paused the update since 2023-05, so we set a 14 days cache ttl, and move it to extra
  // [
  //   'https://pup-filter.pages.dev/pup-filter-domains.txt',
  //   [
  //     // 'https://malware-filter.pages.dev/pup-filter-domains.txt',
  //     // 'https://malware-filter.gitlab.io/malware-filter/pup-filter-domains.txt',
  //     'https://malware-filter.gitlab.io/pup-filter/pup-filter-domains.txt'
  //     // 'https://curbengh.github.io/pup-filter/pup-filter-domains.txt',
  //     // 'https://malware-filter.pages.dev/pup-filter-domains.txt'
  //   ],
  //   true, TTL.TWO_WEEKS()
  // ],
  // Curben's UrlHaus Malicious URL Blocklist
  [
    'https://urlhaus-filter.pages.dev/urlhaus-filter-domains.txt',
    [
      'https://malware-filter.pages.dev/urlhaus-filter-domains.txt',
      'https://malware-filter.gitlab.io/urlhaus-filter/urlhaus-filter-domains.txt',
      'https://malware-filter.gitlab.io/malware-filter/urlhaus-filter-domains.txt',
      'https://curbengh.github.io/urlhaus-filter/urlhaus-filter-domains.txt'
    ],
    true, TTL.THREE_HOURS()
  ],
  // Spam404
  // Not actively maintained, let's use a 10 days cache ttl
  ['https://raw.githubusercontent.com/Spam404/lists/master/main-blacklist.txt', [], true, TTL.TEN_DAYS()]
];

export const PHISHING_DOMAIN_LISTS_EXTRA: HostsSource[] = [
  [
    'https://phishing-filter.pages.dev/phishing-filter-domains.txt',
    [
      'https://malware-filter.pages.dev/phishing-filter-domains.txt',
      'https://malware-filter.gitlab.io/phishing-filter/phishing-filter-domains.txt',
      'https://malware-filter.gitlab.io/malware-filter/phishing-filter-domains.txt',
      'https://curbengh.github.io/phishing-filter/phishing-filter-domains.txt'
    ],
    true, TTL.THREE_HOURS()
  ],
  [
    'https://phishing.army/download/phishing_army_blocklist.txt',
    [],
    true, TTL.THREE_HOURS()
  ]
];

export const PHISHING_HOSTS_EXTRA: HostsSource[] = [
  [
    'https://raw.githubusercontent.com/durablenapkin/scamblocklist/master/hosts.txt',
    [],
    true, TTL.TWLVE_HOURS()
  ]
];

type AdGuardFilterSource = [main: string, mirrors: string[] | null, ttl: number, allowThirdParty?: boolean];

export const ADGUARD_FILTERS: AdGuardFilterSource[] = [
  // no coin list adguard list is more maintained than its hosts
  ['https://raw.githubusercontent.com/hoshsadiq/adblock-nocoin-list/master/nocoin.txt', [], TTL.TWO_WEEKS()],
  // EasyList
  [
    'https://easylist.to/easylist/easylist.txt',
    [
      'https://easylist-downloads.adblockplus.org/easylist.txt',
      'https://secure.fanboy.co.nz/easylist.txt',
      'https://ublockorigin.github.io/uAssetsCDN/thirdparties/easylist.txt',
      'https://ublockorigin.pages.dev/thirdparties/easylist.txt',
      'https://raw.githubusercontent.com/easylist/easylist/gh-pages/easylist.txt'
    ],
    TTL.TWLVE_HOURS()
  ],
  // EasyPrivacy
  [
    'https://easylist.to/easylist/easyprivacy.txt',
    [
      'https://easylist-downloads.adblockplus.org/easyprivacy.txt',
      'https://secure.fanboy.co.nz/easyprivacy.txt',
      'https://ublockorigin.github.io/uAssetsCDN/thirdparties/easyprivacy.txt',
      'https://ublockorigin.pages.dev/thirdparties/easyprivacy.txt',
      'https://raw.githubusercontent.com/easylist/easylist/gh-pages/easyprivacy.txt'
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
  // AdGuard Base Filter
  ['https://filters.adtidy.org/extension/ublock/filters/2_without_easylist.txt', null, TTL.THREE_HOURS()],
  // AdGuard Mobile AD
  ['https://filters.adtidy.org/extension/ublock/filters/11_optimized.txt', null, TTL.THREE_HOURS()],
  // AdGuard Tracking Protection
  ['https://filters.adtidy.org/extension/ublock/filters/3_optimized.txt', null, TTL.THREE_HOURS()],
  // AdGuard Chinese filter (EasyList China + AdGuard Chinese filter)
  ['https://filters.adtidy.org/extension/ublock/filters/224_optimized.txt', null, TTL.THREE_HOURS()],
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
  // uBlock Origin Unbreak
  [
    'https://ublockorigin.github.io/uAssetsCDN/filters/unbreak.min.txt',
    [
      'https://ublockorigin.pages.dev/filters/unbreak.min.txt'
    ],
    TTL.THREE_HOURS()
  ]
];

export const ADGUARD_FILTERS_WHITELIST: AdGuardFilterSource[] = [
  [
    'https://adguardteam.github.io/AdGuardSDNSFilter/Filters/exceptions.txt',
    [
      'https://raw.githubusercontent.com/AdguardTeam/AdGuardSDNSFilter/master/Filters/exceptions.txt'
    ],
    TTL.THREE_HOURS()
  ],
  [
    'https://adguardteam.github.io/AdGuardSDNSFilter/Filters/exclusions.txt',
    [
      'https://raw.githubusercontent.com/AdguardTeam/AdGuardSDNSFilter/master/Filters/exclusions.txt'
    ],
    TTL.THREE_HOURS()
  ]
];

export const ADGUARD_FILTERS_EXTRA: AdGuardFilterSource[] = [
  // AdGuard Annoyances filter
  ['https://filters.adtidy.org/extension/ublock/filters/14_optimized.txt', null, TTL.THREE_HOURS(), true],
  // AdGuard Cookie Notices, included in Annoyances filter
  // ['https://filters.adtidy.org/extension/ublock/filters/18_optimized.txt', null, TTL.THREE_HOURS(), true],
  // EasyList Germany filter, not even included in extra for now
  // [
  //   'https://easylist.to/easylistgermany/easylistgermany.txt',
  //   [
  //     'https://easylist-downloads.adblockplus.org/easylistgermany.txt'
  //   ],
  //   TTL.TWLVE_HOURS()
  // ],
  // AdGuard Japanese filter
  ['https://filters.adtidy.org/extension/ublock/filters/7_optimized.txt', null, TTL.THREE_HOURS()],
  // uBlock Origin Filter List
  [
    'https://ublockorigin.github.io/uAssetsCDN/filters/filters.min.txt',
    [
      'https://ublockorigin.pages.dev/filters/filters.min.txt'
    ],
    TTL.THREE_HOURS()
  ],
  // AdGuard Popup Overlay - included in Annoyances filter
  // ['https://filters.adtidy.org/extension/ublock/filters/19_optimized.txt', null, TTL.THREE_HOURS(), true],
  // AdGuard Mobile Banner
  // almost all generic rule
  // ['https://filters.adtidy.org/extension/ublock/filters/20_optimized.txt', null, TTL.THREE_HOURS()],
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
  //   ['https://ublockorigin.pages.dev/filters/resource-abuse.txt']
  // ],
  // uBlock Origin Annoyances
  [
    'https://ublockorigin.github.io/uAssetsCDN/filters/annoyances.min.txt',
    ['https://ublockorigin.pages.dev/filters/annoyances.min.txt'],
    TTL.THREE_HOURS()
  ],
  // EasyList Annoyances
  [
    'https://ublockorigin.github.io/uAssetsCDN/thirdparties/easylist-annoyances.txt',
    ['https://ublockorigin.pages.dev/thirdparties/easylist-annoyances.txt'],
    TTL.THREE_HOURS()
  ],
  // Dandelion Sprout's Annoyances
  ['https://filters.adtidy.org/extension/ublock/filters/250_optimized.txt', null, TTL.THREE_HOURS(), true],
  // EasyList - Newsletters
  [
    'https://ublockorigin.github.io/uAssetsCDN/thirdparties/easylist-newsletters.txt',
    ['https://ublockorigin.pages.dev/thirdparties/easylist-newsletters.txt'],
    TTL.THREE_HOURS()
  ],
  // EasyList - Notifications
  [
    'https://ublockorigin.github.io/uAssets/thirdparties/easylist-notifications.txt',
    ['https://ublockorigin.pages.dev/thirdparties/easylist-notifications.txt'],
    TTL.THREE_HOURS()
  ],
  // Fanboy Cookie Monster (EasyList Cookie List)
  [
    'https://ublockorigin.github.io/uAssets/thirdparties/easylist-cookies.txt',
    [
      'https://ublockorigin.pages.dev/thirdparties/easylist-cookies.txt',
      'https://secure.fanboy.co.nz/fanboy-cookiemonster_ubo.txt'
    ],
    TTL.TWLVE_HOURS()
  ]
];

// In a hostile network like when an ad blocker is present, apps might be crashing, and these errors need to be
// The reason for unblocking crashlytics is to not make developers life worse by breaking crash reporting.
// In a hostile network like when an ad blocker is present, apps might be crashing, and these errors need to be
// reported to devs, otherwise they won't learn about the issue and won't fix it.
// Also, it is not a common third-party analytics tracker, Crashlytics is not used for collecting users' data.
export const CRASHLYTICS_WHITELIST = [
  // VSCode Telemetry, see https://sts.online.visualstudio.com/api/swagger/index.html
  'sts.online.visualstudio.com',
  // Sentry
  '.ingest.sentry.io',
  // bugsnag
  '.sessions.bugsnag.com',
  '.notify.bugsnag.com',
  // influxdata
  '.cloud.influxdata.com',
  '.cloud1.influxdata.com',
  '.cloud2.influxdata.com',
  // split.io A/B flag
  'streaming.split.io',
  'telemetry.split.io',
  'sdk.split.io',
  // Google
  // -ds.metric.gstatic.com are specifically exempted from reject, but it could use secondary proxy policy
  '.metric.gstatic.com',
  // Misc
  'telemetry.1passwordservices.com',
  'events.tableplus.com',
  'telemetry.nextjs.org',
  'telemetry.vercel.com',
  'stats.setapp.com',
  'stats.setapp.macpaw.dev',
  '.app-analytics-services.com',
  '.telemetry.services.yofi.ai',
  '.cdn.pubnub.com',
  '.data.debugbear.com',
  '.cdn.applicationinsights.io',
  '.applicationinsights.azure.com',
  '.applicationinsights.azure.cn',
  '.api.loganalytics.io',
  '.bugly.qcloud.com',
  '.cdn.signalfx.com',
  '.crash-reports.browser.yandex.net',
  '.crashlytics2.l.google.com',
  '.crashlyticsreports-pa.googleapis.com',
  '.e.crashlytics.com',
  '.events.backtrace.io',
  '.events.split.io',
  '.in.appcenter.ms',
  '.loggly.com',
  '.logz.io',
  '.opentelemetry.io',
  '.raygun.io', // dashboard lives at raygun.com
  '.rum.cronitor.io',
  '.settings.crashlytics.com',
  '.sny.monosnap.com',
  '.lr-ingest.com',
  '.cdn.rollbar.com',
  '.api.instabug.com',
  '.ensighten.com'
];

export const PREDEFINED_WHITELIST = [
  ...CRASHLYTICS_WHITELIST,
  '.localhost',
  '.local',
  '.localhost.localdomain',
  '.broadcasthost',
  '.ip6-loopback',
  '.ip6-localnet',
  '.ip6-mcastprefix',
  '.ip6-allnodes',
  '.ip6-allrouters',
  '.ip6-allhosts',
  '.mcastprefix',
  '.skk.moe',
  '.cdn.cloudflare.net', // Surge/Clash doesn't support CNAME
  'analytics.google.com',
  '.cloud.answerhub.com',
  'ae01.alicdn.com',
  '.whoami.akamai.net',
  '.whoami.ds.akahelp.net',
  'pxlk9.net.', // This one is malformed from EasyList, which I will manually add instead
  '.instant.page', // No, it doesn't violate anyone's privacy. I will whitelist it
  '.piwik.pro',
  'mixpanel.com',
  'cdn.mxpnl.com',
  '.heapanalytics.com',
  '.segment.com',
  '.segmentify.com',
  '.t.co', // pgl yoyo add t.co to the blacklist
  '.survicate.com', // AdGuardDNSFilter
  '.perfops.io', // AdGuardDNSFilter
  '.d2axgrpnciinw7.cloudfront.net', // ADGuardDNSFilter
  '.sb-cd.com', // AdGuard
  '.storage.yandexcloud.net', // phishing list
  '.login.microsoftonline.com', // phishing list
  'api.xiaomi.com', // https://github.com/jerryn70/GoodbyeAds/issues/281
  'api.io.mi.com', // https://github.com/jerryn70/GoodbyeAds/issues/281
  '.cdn.userreport.com', // https://github.com/AdguardTeam/AdGuardSDNSFilter/issues/1158
  '.ip-api.com',
  '.fastly-analytics.com',
  '.digitaloceanspaces.com',
  's3.nl-ams.scw.cloud',
  '.geolocation-db.com',
  '.uploads.codesandbox.io',
  '.vlscppe.microsoft.com', // Affect Windows ISO download https://raw.githubusercontent.com/AdguardTeam/cname-trackers/master/data/combined_disguised_trackers.txt
  '.statsig.com', // OpenAI use this for A/B testing
  '.pstmrk.it', // Fuck Peter Lowe Hosts
  '.clicks.mlsend.com', // Fuck Peter Lowe Hosts
  'email.accounts.bitly.com', // Fuck Peter Lowe Hosts
  'adsense.google.com', // Fuck Peter Lowe Hosts
  'api.vip.miui.com', // Fuck Goodbye Xiaomi Ads
  '.ai.api.xiaomi.com', // Fuck Goodbye Xiaomi Ads
  'm.stripe.com', // EasyPrivacy only blocks m.stripe.com wwith $third-party,
  // yet stupid AdGuardDNSFilter blocks all of it. Stupid AdGuard
  '.w3s.link', // stupid phishing.army, introduce both "*.ipfs.w3s.link" and ".w3s.link" to the block list
  '.r2.dev', // Despite 5000+ r2 instances used for phishing, yet cloudflare refuse to do anything. we have no choice but whitelist this.
  'mlsend.com', // Fuck Peter Lowe Hosts
  'ab.chatgpt.com', // EasyPrivacy blocks this
  'jnn-pa.googleapis.com', // ad-wars
  'imasdk.googleapis.com', // ad-wars
  '.l.qq.com' // ad-wars
];
