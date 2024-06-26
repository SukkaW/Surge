export interface DNSMapping {
  hosts: {
    [domain: string]: string[]
  },
  dns: string,
  domains: string[]
}

export const DIRECTS = {
  ROUTER: {
    dns: 'system',
    hosts: {},
    domains: [
      // Aruba Router
      'instant.arubanetworks.com',
      'setmeup.arubanetworks.com',
      // ASUS router
      'router.asus.com',
      'repeater.asus.com',
      'asusrouter.com',
      // NetGear
      'routerlogin.net',
      // Tenda WiFi
      'tendawifi.com',
      // TP-Link Router
      'tplinkwifi.net',
      'tplogin.cn',
      'tplinkap.net',
      'tplinkeap.net',
      'tplinkmodem.net',
      'tplinkplclogin.net',
      'tplinkrepeater.net',
      // Xiaomi Router
      'miwifi.com',
      // ZTE CPE
      'zte.home',
      // UniFi
      'ui.direct',
      'unifi',
      'amplifi.lan',
      // Other Router
      'hiwifi.com',
      'huaweimobilewifi.com',
      'my.router',
      'phicomm.me',
      'router.ctc',
      'peiluyou.com',
      'airbox.home',
      'arcor.easybox',
      'aterm.me',
      'bthub.home',
      'bthomehub.home',
      'congstar.box',
      'connect.box',
      'console.gl-inet.com',
      'easy.box',
      'etxr',
      'fritz.box',
      'fritz.nas',
      'fritz.repeater',
      'giga.cube',
      'hi.link',
      'hitronhub.home',
      'homerouter.cpe',
      'myfritz.box',
      'mobile.hotspot',
      'ntt.setup',
      'pi.hole',
      'plex.direct',
      'app.plex.tv',
      'routerlogin.com',
      'samsung.router',
      'speedport.ip',
      'steamloopback.host',
      'web.setup',
      'web.setup.home'
    ]
  },
  SYSTEM: {
    dns: 'system',
    hosts: {},
    domains: [
      '_hotspot_.m2m',
      'hotspot.cslwifi.com',
      // TailScale Magic DNS
      'ts.net',
      // AdGuard
      'injections.adguard.org',
      'local.adguard.org'
    ]
  }
} satisfies Record<string, DNSMapping>;

export const LANS = {
  LAN: {
    dns: 'system',
    hosts: {},
    domains: [
      'lan',
      'localhost',
      'localdomain',
      'home.arpa',
      // AS112
      '10.in-addr.arpa',
      '16.172.in-addr.arpa',
      '17.172.in-addr.arpa',
      '18.172.in-addr.arpa',
      '19.172.in-addr.arpa',
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
  }
} satisfies Record<string, DNSMapping>;
