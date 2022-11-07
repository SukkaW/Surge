/** @type {[string, boolean][]} */
const HOSTS = [
  ['https://pgl.yoyo.org/adservers/serverlist.php?hostformat=hosts&showintro=0&mimetype=plaintext', true],
  ['https://raw.githubusercontent.com/hoshsadiq/adblock-nocoin-list/master/hosts.txt', false],
  ['https://raw.githubusercontent.com/crazy-max/WindowsSpyBlocker/master/data/hosts/spy.txt', false]
]

const ADGUARD_FILTERS = [
  // Easy List
  [
    'https://easylist.to/easylist/easylist.txt',
    [
      'https://easylist-downloads.adblockplus.org/easylist.txt',
      'https://raw.githubusercontent.com/easylist/easylist/gh-pages/easylist.txt',
      'https://secure.fanboy.co.nz/easylist.txt'
    ]
  ],
  // AdGuard DNS Filter
  'https://adguardteam.github.io/AdGuardSDNSFilter/Filters/filter.txt',
  // uBlock Origin Filter List
  [
    'https://ublockorigin.github.io/uAssets/filters/filters.txt',
    [
      'https://ublockorigin.github.io/uAssetsCDN/filters/filters.txt',
      'https://ublockorigin.pages.dev/filters/filters.txt'
    ]
  ],
  [
    'https://ublockorigin.github.io/uAssets/filters/filters-2020.txt',
    [
      'https://ublockorigin.github.io/uAssetsCDN/filters/filters-2020.txt',
      'https://ublockorigin.pages.dev/filters/filters-2020.txt'
    ]
  ],
  [
    'https://ublockorigin.github.io/uAssets/filters/filters-2021.txt',
    [
      'https://ublockorigin.github.io/uAssetsCDN/filters/filters-2021.txt',
      'https://ublockorigin.pages.dev/filters/filters-2021.txt'
    ]
  ],
  [
    'https://ublockorigin.github.io/uAssets/filters/filters-2022.txt',
    [
      'https://ublockorigin.github.io/uAssetsCDN/filters/filters-2022.txt',
      'https://ublockorigin.pages.dev/filters/filters-2022.txt'
    ]
  ],
  // uBlock Origin Badware Risk List
  [
    'https://ublockorigin.github.io/uAssets/filters/badware.txt',
    [
      'https://ublockorigin.github.io/uAssetsCDN/filters/badware.txt',
      'https://ublockorigin.pages.dev/filters/badware.txt'
    ]
  ],
  // uBlock Origin Privacy List
  [
    'https://ublockorigin.github.io/uAssets/filters/privacy.txt',
    [
      'https://ublockorigin.github.io/uAssetsCDN/filters/privacy.txt',
      'https://ublockorigin.pages.dev/filters/privacy.txt'
    ]
  ],
  // uBlock Origin Resource Abuse
  [
    'https://ublockorigin.github.io/uAssets/filters/resource-abuse.txt',
    [
      'https://ublockorigin.github.io/uAssetsCDN/filters/resource-abuse.txt',
      'https://ublockorigin.pages.dev/filters/resource-abuse.txt'
    ]
  ],
  // uBlock Origin Unbreak
  [
    'https://ublockorigin.github.io/uAssets/filters/unbreak.txt',
    [
      'https://ublockorigin.github.io/uAssetsCDN/filters/unbreak.txt',
      'https://ublockorigin.pages.dev/filters/unbreak.txt'
    ]
  ],
  // AdGuard Base Filter
  'https://filters.adtidy.org/extension/ublock/filters/2_without_easylist.txt',
  // AdGuard Mobile AD
  'https://filters.adtidy.org/extension/ublock/filters/11.txt',
  // AdGuard Tracking Protection
  'https://filters.adtidy.org/extension/ublock/filters/3.txt',
  // AdGuard Japanese filter
  'https://filters.adtidy.org/extension/ublock/filters/7.txt',
  // AdGuard Chinese filter (EasyList China + AdGuard Chinese filter)
  'https://filters.adtidy.org/extension/ublock/filters/224.txt',
  // Easy Privacy
  [
    'https://easylist.to/easylist/easyprivacy.txt',
    [
      'https://secure.fanboy.co.nz/easyprivacy.txt',
      'https://raw.githubusercontent.com/easylist/easylist/gh-pages/easyprivacy.txt',
      'https://easylist-downloads.adblockplus.org/easyprivacy.txt'
    ]
  ],
  // Curben's UrlHaus Malicious URL Blocklist
  [
    'https://curbengh.github.io/urlhaus-filter/urlhaus-filter-agh-online.txt',
    [
      'https://urlhaus-filter.pages.dev/urlhaus-filter-agh-online.txt',
      // Prefer mirror, since malware-filter.gitlab.io has not been updated for a while
      // 'https://malware-filter.gitlab.io/urlhaus-filter/urlhaus-filter-agh-online.txt'
    ]
  ],
  // Curben's Phishing URL Blocklist
  [
    'https://curbengh.github.io/phishing-filter/phishing-filter-agh.txt',
    [
      'https://phishing-filter.pages.dev/phishing-filter-agh.txt',
      // Prefer mirror, since malware-filter.gitlab.io has not been updated for a while
      // 'https://malware-filter.gitlab.io/malware-filter/phishing-filter-agh.txt'
    ]
  ],
  // Curben's PUP Domains Blocklist
  [
    'https://curbengh.github.io/pup-filter/pup-filter-agh.txt',
    [
      'https://pup-filter.pages.dev/pup-filter-agh.txt',
      // Prefer mirror, since malware-filter.gitlab.io has not been updated for a while
      // 'https://malware-filter.gitlab.io/malware-filter/pup-filter-agh.txt'
    ]
  ],
  // GameConsoleAdblockList
  'https://raw.githubusercontent.com/DandelionSprout/adfilt/master/GameConsoleAdblockList.txt',
  // PiHoleBlocklist
  'https://raw.githubusercontent.com/Perflyst/PiHoleBlocklist/master/SmartTV-AGH.txt',
  // Spam404
  'https://raw.githubusercontent.com/Spam404/lists/master/adblock-list.txt'
];

const PREDEFINED_WHITELIST = [
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
  'msa.cdn.mediaset.net', // Added manually using DOMAIN-KEYWORDS
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
  'login.microsoftonline.com' // phishing list
];

module.exports.HOSTS = HOSTS;
module.exports.ADGUARD_FILTERS = ADGUARD_FILTERS;
module.exports.PREDEFINED_WHITELIST = PREDEFINED_WHITELIST;
