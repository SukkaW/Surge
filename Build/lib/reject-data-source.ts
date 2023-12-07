export const HOSTS = [
  ['https://pgl.yoyo.org/adservers/serverlist.php?hostformat=hosts&showintro=0&mimetype=plaintext', true],
  ['https://someonewhocares.org/hosts/hosts', true],
  ['https://raw.githubusercontent.com/hoshsadiq/adblock-nocoin-list/master/hosts.txt', false],
  ['https://raw.githubusercontent.com/crazy-max/WindowsSpyBlocker/master/data/hosts/spy.txt', false],
  ['https://raw.githubusercontent.com/jerryn70/GoodbyeAds/master/Extension/GoodbyeAds-Xiaomi-Extension.txt', false],
  ['https://raw.githubusercontent.com/jdlingyu/ad-wars/master/hosts', false],
  ['https://raw.githubusercontent.com/durablenapkin/block/master/luminati.txt', true],
  // Curben's UrlHaus Malicious URL Blocklist
  // 'https://curbengh.github.io/urlhaus-filter/urlhaus-filter-agh-online.txt',
  // 'https://urlhaus-filter.pages.dev/urlhaus-filter-agh-online.txt',
  // 'https://ublockorigin.github.io/uAssets/thirdparties/urlhaus-filter/urlhaus-filter-online.txt',
  ['https://curbengh.github.io/urlhaus-filter/urlhaus-filter-hosts.txt', true, true],
  // Curben's Phishing URL Blocklist
  // 'https://curbengh.github.io/phishing-filter/phishing-filter-agh.txt'
  // 'https://phishing-filter.pages.dev/phishing-filter-agh.txt'
  ['https://curbengh.github.io/phishing-filter/phishing-filter-hosts.txt', true, true],
  // Curben's PUP Domains Blocklist
  // 'https://curbengh.github.io/pup-filter/pup-filter-agh.txt'
  // 'https://pup-filter.pages.dev/pup-filter-agh.txt'
  ['https://curbengh.github.io/pup-filter/pup-filter-hosts.txt', true, true],
  // BarbBlock
  ['https://paulgb.github.io/BarbBlock/blacklists/hosts-file.txt', true, true]
] as const;

export const ADGUARD_FILTERS = [
  // EasyList
  [
    'https://easylist.to/easylist/easylist.txt',
    [
      'https://easylist-downloads.adblockplus.org/easylist.txt',
      'https://raw.githubusercontent.com/easylist/easylist/gh-pages/easylist.txt',
      'https://secure.fanboy.co.nz/easylist.txt',
      'https://ublockorigin.github.io/uAssets/thirdparties/easylist.txt',
      'https://ublockorigin.pages.dev/thirdparties/easylist.txt'
    ]
  ],
  // EasyPrivacy
  [
    'https://easylist.to/easylist/easyprivacy.txt',
    [
      'https://secure.fanboy.co.nz/easyprivacy.txt',
      'https://raw.githubusercontent.com/easylist/easylist/gh-pages/easyprivacy.txt',
      'https://easylist-downloads.adblockplus.org/easyprivacy.txt',
      'https://ublockorigin.github.io/uAssets/thirdparties/easyprivacy.txt',
      'https://ublockorigin.pages.dev/thirdparties/easyprivacy.txt'
    ]
  ],
  // AdGuard DNS Filter
  [
    'https://adguardteam.github.io/AdGuardSDNSFilter/Filters/filter.txt',
    [
      'https://filters.adtidy.org/extension/chromium/filters/15.txt'
    ]
  ],
  // AdGuard CNAME Filter Combined
  'https://raw.githubusercontent.com/AdguardTeam/cname-trackers/master/data/combined_disguised_ads.txt',
  'https://raw.githubusercontent.com/AdguardTeam/cname-trackers/master/data/combined_disguised_trackers.txt',
  'https://raw.githubusercontent.com/AdguardTeam/cname-trackers/master/data/combined_disguised_clickthroughs.txt',
  'https://raw.githubusercontent.com/AdguardTeam/cname-trackers/master/data/combined_disguised_microsites.txt',
  'https://raw.githubusercontent.com/AdguardTeam/cname-trackers/master/data/combined_disguised_mail_trackers.txt',
  // uBlock Origin Filter List
  [
    'https://ublockorigin.github.io/uAssets/filters/filters.min.txt',
    [
      'https://ublockorigin.github.io/uAssetsCDN/filters/filters.min.txt',
      'https://ublockorigin.pages.dev/filters/filters.min.txt'
    ]
  ],
  // uBlock Origin Badware Risk List
  [
    'https://ublockorigin.github.io/uAssets/filters/badware.min.txt',
    [
      'https://ublockorigin.github.io/uAssetsCDN/filters/badware.min.txt',
      'https://ublockorigin.pages.dev/filters/badware.min.txt'
    ]
  ],
  // uBlock Origin Privacy List
  [
    'https://ublockorigin.github.io/uAssets/filters/privacy.min.txt',
    [
      'https://ublockorigin.github.io/uAssetsCDN/filters/privacy.min.txt',
      'https://ublockorigin.pages.dev/filters/privacy.min.txt'
    ]
  ],
  // uBlock Origin Resource Abuse: merged in uBlock Origin Privacy List
  // [
  //   'https://ublockorigin.github.io/uAssets/filters/resource-abuse.txt',
  //   [
  //     'https://ublockorigin.github.io/uAssetsCDN/filters/resource-abuse.txt',
  //     'https://ublockorigin.pages.dev/filters/resource-abuse.txt'
  //   ]
  // ],
  // uBlock Origin Unbreak
  [
    'https://ublockorigin.github.io/uAssets/filters/unbreak.min.txt',
    [
      'https://ublockorigin.github.io/uAssetsCDN/filters/unbreak.min.txt',
      'https://ublockorigin.pages.dev/filters/unbreak.min.txt'
    ]
  ],
  // AdGuard Base Filter
  'https://filters.adtidy.org/extension/ublock/filters/2_without_easylist.txt',
  // AdGuard Mobile AD
  'https://filters.adtidy.org/extension/ublock/filters/11_optimized.txt',
  // AdGuard Tracking Protection
  'https://filters.adtidy.org/extension/ublock/filters/3_optimized.txt',
  // AdGuard Japanese filter
  'https://filters.adtidy.org/extension/ublock/filters/7_optimized.txt',
  // AdGuard Chinese filter (EasyList China + AdGuard Chinese filter)
  'https://filters.adtidy.org/extension/ublock/filters/224_optimized.txt',
  // AdGuard Annoyances filter
  'https://filters.adtidy.org/android/filters/14_optimized.txt',
  // EasyList Germany filter
  [
    'https://easylist.to/easylistgermany/easylistgermany.txt',
    [
      'https://easylist-downloads.adblockplus.org/easylistgermany.txt'
    ]
  ],
  // GameConsoleAdblockList
  'https://raw.githubusercontent.com/DandelionSprout/adfilt/master/GameConsoleAdblockList.txt',
  // PiHoleBlocklist
  [
    'https://perflyst.github.io/PiHoleBlocklist/SmartTV-AGH.txt',
    [
      'https://raw.githubusercontent.com/Perflyst/PiHoleBlocklist/master/SmartTV-AGH.txt'
    ]
  ],
  // Spam404
  'https://raw.githubusercontent.com/Spam404/lists/master/adblock-list.txt',
  // Brave First Party & First Party CNAME
  'https://raw.githubusercontent.com/brave/adblock-lists/master/brave-lists/brave-firstparty.txt'
] as const;

export const PREDEFINED_WHITELIST = [
  'localhost',
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

export const PREDEFINED_ENFORCED_BACKLIST = [
  'telemetry.mozilla.org'
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
