// https://en.wikipedia.org/wiki/Reserved_IP_addresses
export const RESERVED_IPV4_CIDR = [
  '0.0.0.0/8',
  '10.0.0.0/8',
  '100.64.0.0/10',
  '127.0.0.0/8',
  '169.254.0.0/16',
  '172.16.0.0/12',
  '192.0.0.0/24',
  '192.0.2.0/24',
  // 192.88.99.0 // is currently being broadcast by HE and Comcast
  '192.168.0.0/16',
  '198.18.0.0/15',
  '198.51.100.0/24',
  '203.0.113.0/24',
  '224.0.0.0/4',
  '233.252.0.0/24',
  '240.0.0.0/4'
];

// https://github.com/misakaio/chnroutes2/issues/25
export const NON_CN_CIDR_INCLUDED_IN_CHNROUTE = [
  '223.118.0.0/15',
  '223.120.0.0/15'
];

export const CN_CIDR_NOT_INCLUDED_IN_CHNROUTE = [
  '211.99.96.0/19' // wy.com.cn
];
