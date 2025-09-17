export const DEBUG_DOMAIN_TO_FIND: string | null = null; // example.com | null

type HostsSource = [main: string, mirrors: string[] | null, includeAllSubDomain: boolean, allowEmptyRemote?: boolean];

export const HOSTS: HostsSource[] = [
  // WindowsSpyBlocker hasn't been updated since 2022-06-16, its content has been merged into domainset/reject.conf
  // [
  //   'https://cdn.jsdelivr.net/gh/crazy-max/WindowsSpyBlocker@master/data/hosts/spy.txt',
  //   ['https://raw.githubusercontent.com/crazy-max/WindowsSpyBlocker/master/data/hosts/spy.txt'],
  //   true
  // ],
  [
    'https://cdn.jsdelivr.net/gh/jerryn70/GoodbyeAds@master/Extension/GoodbyeAds-Xiaomi-Extension.txt',
    ['https://raw.githubusercontent.com/jerryn70/GoodbyeAds/master/Extension/GoodbyeAds-Xiaomi-Extension.txt'],
    false
  ]
];

export const HOSTS_EXTRA: HostsSource[] = [
  // This stupid hosts blocks t.co, so we determine that this is also bullshit, so it is extra
  [
    'https://pgl.yoyo.org/adservers/serverlist.php?hostformat=hosts&showintro=0&mimetype=plaintext',
    ['https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/thirdparties/pgl.yoyo.org/as/serverlist'],
    true
  ],
  // Dan Pollock's hosts file, 0.0.0.0 version is 30 KiB smaller
  [
    'https://proxy.cdn.skk.moe/https/someonewhocares.org/hosts/zero/hosts',
    [
      'https://someonewhocares.org/hosts/zero/hosts',
      // 2025-07-10 Dan Pollock's website begin to randomly Cloudflare Challenge.
      // enable non-zero hosts as fallbacks.
      'https://someonewhocares.org/hosts/hosts',
      'https://proxy.cdn.skk.moe/https/someonewhocares.org/hosts/hosts'
    ],
    true
  ],
  // ad-wars is not actively maintained since 2023.11 due to Tencent's Legal Notice
  // All contents has been intergrated into the reject.conf file
  // [
  //   'https://cdn.jsdelivr.net/gh/jdlingyu/ad-wars@master/hosts',
  //   ['https://raw.githubusercontent.com/jdlingyu/ad-wars/master/hosts'],
  //   false
  // ],
  // hoshsadiq adblock-nocoin-list extra
  [
    'https://cdn.jsdelivr.net/gh/hoshsadiq/adblock-nocoin-list@master/hosts.txt',
    ['https://raw.githubusercontent.com/hoshsadiq/adblock-nocoin-list/master/hosts.txt'],
    true
  ],
  // GoodbyeAds - Huawei AdBlock, most of its content has been covered by reject.conf, the rest should belongs to reject_extra now
  [
    'https://cdn.jsdelivr.net/gh/jerryn70/GoodbyeAds@master/Extension/GoodbyeAds-Huawei-AdBlock.txt',
    ['https://raw.githubusercontent.com/jerryn70/GoodbyeAds/master/Extension/GoodbyeAds-Huawei-AdBlock.txt'],
    false
  ],
  // GoodbyeAds - Samsung AdBlock
  // most of its content has covered by reject.conf. Remaining domains, some are not even owned by samsung, some are normal API/SSO/DNS
  // blocking them doesn't make sense, yet will not breaking anything anyway, so we move it to extra
  [
    'https://cdn.jsdelivr.net/gh/jerryn70/GoodbyeAds@master/Extension/GoodbyeAds-Samsung-AdBlock.txt',
    ['https://raw.githubusercontent.com/jerryn70/GoodbyeAds/master/Extension/GoodbyeAds-Samsung-AdBlock.txt'],
    false
  ]
];

export const DOMAIN_LISTS: HostsSource[] = [
  // CoinBlockerList
  // The CoinBlockerList is no longer maintained and even close-source, so we no longer trust it
  // instead we maintain a list of our own
  // [
  //   'https://zerodot1.gitlab.io/CoinBlockerLists/list_browser.txt',
  //   [],
  //   true,
  // ]
];

export const DOMAIN_LISTS_EXTRA: HostsSource[] = [
  // CoinBlockerList - Full
  // The CoinBlockerList is no longer maintained and even close-source, so we no longer trust it
  // instead we maintain a list of our own

  // BarbBlock
  // The barbblock list has never been updated since ~~2019-05~~ ~~2023-10~~ 2025-07, merged to reject_extra.conf
  // [
  //   'https://cdn.jsdelivr.net/gh/paulgb/BarbBlock@main/blacklists/domain-list.txt',
  //   ['https://paulgb.github.io/BarbBlock/blacklists/domain-list.txt'],
  //   true
  // ],
  // DigitalSide Threat-Intel - OSINT Hub -- Dead, server offline
  // ['https://osint.digitalside.it/Threat-Intel/lists/latestdomains.txt', [], true],
  // AdGuard CNAME Filter Combined
  // Update on a 7 days basis, so we can also use jsDelivr as primary URL
  [
    'https://cdn.jsdelivr.net/gh/AdguardTeam/cname-trackers@master/data/combined_disguised_ads_justdomains.txt',
    [
      'https://raw.githubusercontent.com/AdguardTeam/cname-trackers/master/data/combined_disguised_ads_justdomains.txt'
    ],
    true
  ],
  [
    'https://cdn.jsdelivr.net/gh/AdguardTeam/cname-trackers@master/data/combined_disguised_trackers_justdomains.txt',
    [
      'https://raw.githubusercontent.com/AdguardTeam/cname-trackers/master/data/combined_disguised_trackers_justdomains.txt'
    ],
    true
  ],
  // Disable clickthrough set. Many mail SaaS uses this kind of technique on their links (even normal links)
  // E.g. links.strava.com
  // [
  //   'https://cdn.jsdelivr.net/gh/AdguardTeam/cname-trackers@master/data/combined_disguised_clickthroughs_justdomains.txt',
  //   [
  //     'https://raw.githubusercontent.com/AdguardTeam/cname-trackers/master/data/combined_disguised_clickthroughs_justdomains.txt'
  //   ],
  //   true
  // ],
  [
    'https://cdn.jsdelivr.net/gh/AdguardTeam/cname-trackers@master/data/combined_disguised_microsites_justdomains.txt',
    [
      'https://raw.githubusercontent.com/AdguardTeam/cname-trackers/master/data/combined_disguised_microsites_justdomains.txt'
    ],
    true
  ],
  // ['https://raw.githubusercontent.com/AdguardTeam/cname-trackers/master/data/combined_disguised_mail_trackers_justdomains.txt', [], true],
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
  //   true
  // ],
  // Curben's UrlHaus Malicious URL Blocklist
  [
    'https://urlhaus-filter.pages.dev/urlhaus-filter-domains-online.txt',
    [
      'https://malware-filter.pages.dev/urlhaus-filter-domains-online.txt',
      'https://malware-filter.gitlab.io/urlhaus-filter/urlhaus-filter-domains-online.txt',
      'https://malware-filter.gitlab.io/malware-filter/urlhaus-filter-domains-online.txt',
      'https://curbengh.github.io/urlhaus-filter/urlhaus-filter-domains-online.txt'
    ],
    true
  ]
  // Spam404
  // Not actively maintained, let's consider it is dead
  // [
  //   'https://cdn.jsdelivr.net/gh/Spam404/lists@master/main-blacklist.txt',
  //   ['https://raw.githubusercontent.com/Spam404/lists/master/main-blacklist.txt'],
  //   true
  // ]
];

export const PHISHING_HOSTS_EXTRA: HostsSource[] = [
  ['https://raw.githubusercontent.com/durablenapkin/scamblocklist/master/hosts.txt', [], true]
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
    true
  ],
  [
    'https://phishing.army/download/phishing_army_blocklist.txt',
    [],
    true
  ]
];

type AdGuardFilterSource = [main: string, mirrors: string[] | null, includeThirdParty?: boolean];

export const ADGUARD_FILTERS: AdGuardFilterSource[] = [
  // EasyList -- Use AdGuard Base Filter w/ EasyList
  // [
  //   'https://easylist.to/easylist/easylist.txt',
  //   [
  //     'https://easylist-downloads.adblockplus.org/easylist.txt',
  //     'https://secure.fanboy.co.nz/easylist.txt',
  //     'https://ublockorigin.github.io/uAssetsCDN/thirdparties/easylist.txt',
  //     'https://ublockorigin.pages.dev/thirdparties/easylist.txt',
  //     'https://raw.githubusercontent.com/easylist/easylist/gh-pages/easylist.txt',
  //     'https://filters.adtidy.org/extension/ublock/filters/101_optimized.txt'
  //   ]
  // ],
  // AdGuard Base Filter -- Use AdGuard Base Filter w/ EasyList
  [
    'https://filters.adtidy.org/extension/ublock/filters/2_optimized.txt',
    ['https://proxy.cdn.skk.moe/https/filters.adtidy.org/extension/ublock/filters/2_optimized.txt']
  ],
  // EasyPrivacy
  [
    'https://easylist.to/easylist/easyprivacy.txt',
    [
      'https://easylist-downloads.adblockplus.org/easyprivacy.txt',
      'https://secure.fanboy.co.nz/easyprivacy.txt',
      'https://filters.adtidy.org/extension/ublock/filters/118_optimized.txt',
      'https://raw.githubusercontent.com/easylist/easylist/gh-pages/easyprivacy.txt',
      'https://ublockorigin.github.io/uAssetsCDN/thirdparties/easyprivacy.txt',
      'https://ublockorigin.pages.dev/thirdparties/easyprivacy.txt'
    ]
    // 3p is included in AdGuardDNSFilter, which we will use that in reject_extra
  ],
  // AdGuard Base Filter: Use AdGuard Base Filter w/ EasyList
  // [
  //   'https://filters.adtidy.org/extension/ublock/filters/2_without_easylist.txt',
  //   ['https://proxy.cdn.skk.moe/https/filters.adtidy.org/extension/ublock/filters/2_without_easylist.txt']
  // ],
  // AdGuard Mobile AD
  [
    'https://filters.adtidy.org/extension/ublock/filters/11_optimized.txt',
    ['https://proxy.cdn.skk.moe/https/filters.adtidy.org/extension/ublock/filters/11_optimized.txt']
  ],
  // AdGuard Tracking Protection
  [
    'https://filters.adtidy.org/extension/ublock/filters/3_optimized.txt',
    ['https://proxy.cdn.skk.moe/https/filters.adtidy.org/extension/ublock/filters/3_optimized.txt']
    // 3p is included in AdGuardDNSFilter
  ],
  // AdGuard Chinese filter (EasyList China + AdGuard Chinese filter)
  [
    'https://filters.adtidy.org/extension/ublock/filters/224_optimized.txt',
    ['https://proxy.cdn.skk.moe/https/filters.adtidy.org/extension/ublock/filters/224_optimized.txt']
  ],
  // GameConsoleAdblockList
  // Update almost once per 1 to 3 months, let's set a 10 days cache ttl
  [
    'https://cdn.jsdelivr.net/gh/DandelionSprout/adfilt@master/GameConsoleAdblockList.txt',
    ['https://raw.githubusercontent.com/DandelionSprout/adfilt/master/GameConsoleAdblockList.txt']
  ],
  // PiHoleBlocklist
  // Hasn't been updated for two years. Merged to reject.conf
  // [
  //   'https://cdn.jsdelivr.net/gh/Perflyst/PiHoleBlocklist@master/SmartTV-AGH.txt',
  //   [
  //     'https://perflyst.github.io/PiHoleBlocklist/SmartTV-AGH.txt',
  //     'https://raw.githubusercontent.com/Perflyst/PiHoleBlocklist/master/SmartTV-AGH.txt'
  //   ]
  // ],
  // uBlock Origin Unbreak
  [
    'https://ublockorigin.github.io/uAssetsCDN/filters/unbreak.min.txt',
    [
      'https://ublockorigin.pages.dev/filters/unbreak.min.txt'
    ]
  ]
  //
  // [
  //   'https://raw.githubusercontent.com/DandelionSprout/adfilt/master/Alternate%20versions%20Anti-Malware%20List/AntiMalwareAdGuardHome.txt',
  //   [
  //     'https://adguardteam.github.io/HostlistsRegistry/assets/filter_12.txt'
  //   ]
  // ]
  // Stalkerware
  // [
  //   'https://raw.githubusercontent.com/AssoEchap/stalkerware-indicators/master/generated/hosts',
  //   [
  //     'https://adguardteam.github.io/HostlistsRegistry/assets/filter_31.txt'
  //   ]
  // ]
];

export const ADGUARD_FILTERS_WHITELIST: AdGuardFilterSource[] = [
  [
    'https://adguardteam.github.io/AdGuardSDNSFilter/Filters/exceptions.txt',
    [
      'https://raw.githubusercontent.com/AdguardTeam/AdGuardSDNSFilter/master/Filters/exceptions.txt'
    ]
  ],
  [
    'https://adguardteam.github.io/AdGuardSDNSFilter/Filters/exclusions.txt',
    [
      'https://raw.githubusercontent.com/AdguardTeam/AdGuardSDNSFilter/master/Filters/exclusions.txt'
    ]
  ]
];

export const ADGUARD_FILTERS_EXTRA: AdGuardFilterSource[] = [
  // AdGuard DNS Filter
  // way too many other countries' domains (JP, Spanish, RU, VN, Turkish, Ukarainian, Dutch, etc.)
  // EasyList, EasyPrivacy, Chinese and general filters are already included in base data source
  // Including extra $third-party rules
  [
    'https://adguardteam.github.io/AdGuardSDNSFilter/Filters/filter.txt',
    [
      'https://filters.adtidy.org/extension/ublock/filters/15_optimized.txt',
      'https://adguardteam.github.io/HostlistsRegistry/assets/filter_1.txt'
    ]
  ],
  // no coin list adguard list is more maintained than its hosts
  [
    'https://cdn.jsdelivr.net/gh/hoshsadiq/adblock-nocoin-list@master/nocoin.txt',
    ['https://raw.githubusercontent.com/hoshsadiq/adblock-nocoin-list/master/nocoin.txt'],
    true
  ],
  // AdGuard Annoyances filter
  [
    'https://filters.adtidy.org/extension/ublock/filters/14_optimized.txt',
    ['https://proxy.cdn.skk.moe/https/filters.adtidy.org/extension/ublock/filters/14_optimized.txt'],
    true
  ],
  // AdGuard Cookie Notices, included in Annoyances filter
  // ['https://filters.adtidy.org/extension/ublock/filters/18_optimized.txt', null, true],
  // EasyList Germany filter, not even included in extra for now
  // [
  //   'https://easylist.to/easylistgermany/easylistgermany.txt',
  //   [
  //     'https://easylist-downloads.adblockplus.org/easylistgermany.txt'
  //   ],
  //
  // ],
  // AdGuard Japanese filter
  [
    'https://filters.adtidy.org/extension/ublock/filters/7_optimized.txt',
    ['https://proxy.cdn.skk.moe/https/filters.adtidy.org/extension/ublock/filters/7_optimized.txt']
  ],
  // uBlock Origin Filter List
  [
    'https://ublockorigin.github.io/uAssetsCDN/filters/filters.min.txt',
    [
      'https://ublockorigin.pages.dev/filters/filters.min.txt'
    ]
  ],
  // AdGuard Popup Overlay - included in Annoyances filter
  // ['https://filters.adtidy.org/extension/ublock/filters/19_optimized.txt', null, true],
  // AdGuard Mobile Banner
  // almost all generic rule
  // ['https://filters.adtidy.org/extension/ublock/filters/20_optimized.txt', null],
  // uBlock Origin Badware Risk List
  [
    'https://ublockorigin.github.io/uAssetsCDN/filters/badware.min.txt',
    [
      'https://ublockorigin.pages.dev/filters/badware.min.txt'
    ]
  ],
  // uBlock Origin Privacy List
  [
    'https://ublockorigin.github.io/uAssetsCDN/filters/privacy.min.txt',
    [
      'https://ublockorigin.pages.dev/filters/privacy.min.txt'
    ]
  ],
  // uBlock Origin Resource Abuse: merged in uBlock Origin Privacy List
  // [
  //   'https://ublockorigin.github.io/uAssetsCDN/filters/resource-abuse.txt',
  //   ['https://ublockorigin.pages.dev/filters/resource-abuse.txt']
  // ],
  // uBlock Origin Annoyances (the un-merged of Fanboy Annoyances List)
  [
    'https://ublockorigin.github.io/uAssetsCDN/filters/annoyances.min.txt',
    ['https://ublockorigin.pages.dev/filters/annoyances.min.txt']
  ],
  // EasyList Annoyances
  [
    'https://ublockorigin.github.io/uAssetsCDN/thirdparties/easylist-annoyances.txt',
    ['https://ublockorigin.pages.dev/thirdparties/easylist-annoyances.txt']
  ],
  // EasyList - Newsletters
  [
    'https://ublockorigin.github.io/uAssetsCDN/thirdparties/easylist-newsletters.txt',
    ['https://ublockorigin.pages.dev/thirdparties/easylist-newsletters.txt']
  ],
  // EasyList - Notifications
  [
    'https://ublockorigin.github.io/uAssets/thirdparties/easylist-notifications.txt',
    ['https://ublockorigin.pages.dev/thirdparties/easylist-notifications.txt']
  ],
  // Fanboy Cookie Monster (EasyList Cookie List)
  [
    'https://ublockorigin.github.io/uAssets/thirdparties/easylist-cookies.txt',
    [
      'https://ublockorigin.pages.dev/thirdparties/easylist-cookies.txt',
      'https://secure.fanboy.co.nz/fanboy-cookiemonster_ubo.txt'
    ]
  ],
  // Dandelion Sprout's Annoyances
  [
    'https://filters.adtidy.org/extension/ublock/filters/250_optimized.txt',
    ['https://proxy.cdn.skk.moe/https/filters.adtidy.org/extension/ublock/filters/250_optimized.txt'],
    true
  ],
  // Adblock Warning Removal List
  [
    'https://easylist-downloads.adblockplus.org/antiadblockfilters.txt',
    [
      'https://filters.adtidy.org/extension/ublock/filters/207_optimized.txt'
    ],
    true
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
  '.ingest.us.sentry.io',
  '.ingest.de.sentry.io',
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
  'b5x-sentry.1passwordservices.com',
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
  'auth.split.io',
  'events.split.io',
  'streaming.split.io',
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
  '.ensighten.com',
  'api.crashguard.me'
];

export const PREDEFINED_WHITELIST = [
  ...CRASHLYTICS_WHITELIST,
  '.localhost',
  '.local',
  '.localdomain',
  '.broadcasthost',
  '.ip6-loopback',
  '.ip6-localnet',
  '.ip6-mcastprefix',
  '.ip6-allnodes',
  '.ip6-allrouters',
  '.ip6-allhosts',
  '.mcastprefix',
  '.skk.moe',
  'analytics.google.com',
  '.cloud.answerhub.com',
  'ae01.alicdn.com',
  '.whoami.akamai.net',
  '.whoami.ds.akahelp.net',
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
  'd2axgrpnciinw7.cloudfront.net', // ADGuardDNSFilter
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
  'api.comm.miui.com', // Xiaomi MIUI phone number database update URL
  '.ai.api.xiaomi.com', // Fuck Goodbye Xiaomi Ads
  'm.stripe.com', // EasyPrivacy only blocks m.stripe.com wwith $third-party,
  // yet stupid AdGuardDNSFilter blocks all of it. Stupid AdGuard
  '.w3s.link', // stupid phishing.army, introduce both "*.ipfs.w3s.link" and ".w3s.link" to the block list
  '.r2.dev', // Despite 5000+ r2 instances used for phishing, yet cloudflare refuse to do anything. we have no choice but whitelist this.
  'mlsend.com', // Fuck Peter Lowe Hosts
  'ab.chatgpt.com', // EasyPrivacy blocks this
  'jnn-pa.googleapis.com', // ad-wars
  'imasdk.googleapis.com', // ad-wars
  '.in-addr.arpa', // rDNS
  '.ip6.arpa', // rDNS
  '.clients.your-server.de', // rDNS .static.183.213.201.138.clients.your-server.de
  '.bc.googleusercontent.com', // rDNS 218.178.172.34.bc.googleusercontent.com
  '.host.secureserver.net', // rDNS .64.149.167.72.host.secureserver.net,
  '.ip.linodeusercontent.com', // rDNS 45-79-169-153.ip.linodeusercontent.com
  '.static.akamaitechnologies.com', // rDNS a23-57-90-107.deploy.static.akamaitechnologies.com
  '.compute.amazonaws.com', // rDNS ec2-3-22-96-128.us-east-2.compute.amazonaws.com
  '.shoppy.gg', // Spam404
  'transcend-cdn.com', // AdGuard Annoyances
  'store1.gofile.io', // Dandelion Sprout's Annoyances List
  'ad.12306.cn', // https://github.com/jdlingyu/ad-wars
  '.ib.snssdk.com', // AdGuard Tracking Protection -- breaks 今日头条专业版
  '.nstool.netease.com', // it is only used to check local dns
  '.wns.windows.com', // Windows Push Notifications. Besides there is no point in adding these

  'widget-mediator.zopim.com', // breaking zendesk chat

  '.llnw.net', // entire llnm.net has dead

  'repo.huaweicloud.com', // urlhaus
  '.hubspotlinks.com', // Peter Lowe Hosts
  'cldup.com', // OSINT
  'cuty.io', // short domain like bitly, blocked by phishing army
  'links.strava.com', // AdGuard CNAME Clickthrough Filters
  'email.strava.com', // EasyList
  'insideruser.microsoft.com', // WindowsSpyBlocker

  // Doesn't make sense: CNAME domains
  '.cdn.cloudflare.net',
  '.apple-dns.net',
  '.data.microsoft.com.akadns.net',

  // Expired domains
  '.expobarrio.com',
  '.hamdandates.com',
  '.amzone.co.jp',
  '.xpanama.net',

  // Migrate from SmartTV-AGH List
  'mhc-ajax-eu.myhomescreen.tv',
  'mhc-ajax-eu-s2.myhomescreen.tv',
  'mhc-xpana-eu.myhomescreen.tv',
  'mhc-xpana-eu-s2.myhomescreen.tv',
  'infolink.pavv.co.kr',
  'hbbtv.zdf.de',
  'hbbtv.prosieben.de',
  'hbbtv.redbutton.de',
  'hbbtv.kika.de'
];

export const BOGUS_NXDOMAIN_DNSMASQ = [
  'https://cdn.jsdelivr.net/gh/felixonmars/dnsmasq-china-list@master/bogus-nxdomain.china.conf',
  ['https://raw.githubusercontent.com/felixonmars/dnsmasq-china-list/master/bogus-nxdomain.china.conf']
] as const;
