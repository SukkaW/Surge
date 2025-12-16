export interface DNSMapping {
  hosts: {
    [domain: string]: string[]
  },
  /** which also disallows wildcard */
  realip: boolean,
  /** should convert to ruleset */
  ruleset: boolean,
  dns: string | null,
  /**
   * domain[0]
   *
   * + subdomain only
   * $ domain only exact match
   * [none] domain and subdomain
   */
  domains: string[]
}

export const DIRECTS = {
  HOTSPOT_CAPTIVE_PORTAL: {
    dns: 'system',
    hosts: {},
    realip: false,
    ruleset: true,
    domains: [
      'securelogin.com.cn',
      '$captive.apple.com',
      '$hotspot.cslwifi.com'
    ]
  },
  SYSTEM: {
    dns: 'system',
    hosts: {},
    realip: true,
    ruleset: false,
    domains: [
      '+m2m',
      // '+ts.net', // TailScale Magic DNS
      // AdGuard -- needs to be real ip otherwise AdGuard App will not recognize it, mustn't be fake ip
      '$injections.adguard.org',
      '$local.adguard.org',
      // Auto Discovery
      '+bogon'
    ]
  }
} as const satisfies Record<string, DNSMapping>;

export const LAN = {
  // By default, all hostnames with the suffix '.local' will be resolved by the system.
  // Some app like OrbStack uses mDNS and this TLD (orb.local) via mDNS.
  // Surge already handles .local with mDNS properly, we should not map to server:system
  LOCAL_SPECIAL: {
    dns: null,
    hosts: {},
    realip: false,
    ruleset: false,
    domains: [
      '+local'
    ]
  },
  LAN_WITHOUT_REAL_IP: {
    dns: 'system',
    hosts: {
      '127.0.0.1.sslip.io': ['127.0.0.1'],
      '127.atlas.skk.moe': ['127.0.0.1']
    },
    realip: false,
    ruleset: true,
    domains: [
      // Common Router
      // 'zte.home', // ZTE CPE
      // 'airbox.home',
      // 'bthub.home',
      // 'bthomehub.home',
      // 'hitronhub.home',
      // 'web.setup.home'

      // Aruba Router
      '$instant.arubanetworks.com',
      '$setmeup.arubanetworks.com',
      // ASUS router
      '$router.asus.com',
      '$repeater.asus.com',
      'asusrouter.com',
      // NetGear
      'routerlogin.net',
      'routerlogin.com',
      // Tenda WiFi
      // 'tendawifi.com',
      // TP-Link Router
      'tplinkwifi.net',
      'tplogin.cn',
      'tplinkap.net',
      'tplinkmodem.net',
      'tplinkplclogin.net',
      'tplinkrepeater.net',
      // UniFi
      '+ui.direct',
      '$unifi',
      // Other Router
      // '$router.com',
      '+huaweimobilewifi.com',
      '+router',
      // 'my.router',
      // 'samsung.router',
      // '$easy.box', // Vodafone EasyBox
      '$aterm.me',
      '$console.gl-inet.com',
      // '$fritz.box',
      // '$fritz.repeater',
      // '$myfritz.box',
      // '$speedport.ip', // Telekom
      // '$giga.cube', // Vodafone GigaCube
      '$homerouter.cpe', // Huawei LTE CPE
      '$mobile.hotspot', // T-Mobile Hotspot
      '$ntt.setup',
      '$pi.hole',
      '+plex.direct',
      // 'web.setup'
      // AS112
      '+home',
      '10.in-addr.arpa',
      '16.172.in-addr.arpa',
      '17.172.in-addr.arpa',
      '18.172.in-addr.arpa',
      '19.172.in-addr.arpa',
      // '2?.172.in-addr.arpa',
      '20.172.in-addr.arpa',
      '21.172.in-addr.arpa',
      '22.172.in-addr.arpa',
      '23.172.in-addr.arpa',
      '24.172.in-addr.arpa',
      '25.172.in-addr.arpa',
      '26.172.in-addr.arpa',
      '27.172.in-addr.arpa',
      '28.172.in-addr.arpa',
      '29.172.in-addr.arpa',
      '30.172.in-addr.arpa',
      '31.172.in-addr.arpa',
      '168.192.in-addr.arpa',
      '254.169.in-addr.arpa'
    ]
  },
  LAN_WITH_REALIP: {
    dns: 'system',
    hosts: {
      // localhost: ['127.0.0.1']
    },
    realip: true,
    ruleset: true,
    domains: [
      '+lan',
      // By default, all hostnames with the suffix '.local' will be resolved by the system.
      // Some app like OrbStack uses mDNS and this TLD (orb.local) via mDNS.
      // Surge already handles .local with mDNS properly, we should not map to server:system
      // '+local',
      '+internal',
      // 'amplifi.lan',
      // '$localhost',
      '+localdomain',
      'home.arpa',
      '127.0.0.1.sslip.io',
      '127.atlas.skk.moe'
    ]
  }
} as const satisfies Record<string, DNSMapping>;

export const HOSTS = {
  HOSTS: {
    // not actually used, only for a placeholder
    dns: '',
    hosts: {
      'cdn.jsdelivr.net': ['cdn.jsdelivr.net.cdn.cloudflare.net']
    },
    realip: false,
    ruleset: false,
    domains: [] as never[]
  }
} as const satisfies Record<string, DNSMapping>;
