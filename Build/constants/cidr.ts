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

// https://github.com/misakaio/chnroutes2/issues/46
export const CN_CIDR_NOT_INCLUDED_IN_CHNROUTE = [
  '211.99.96.0/19', // wy.com.cn

  '40.72.0.0/15', // AS58593, Azure China, Shanghai
  '42.159.0.0/16', // AS58593, Azure China, Shanghai
  '52.130.0.0/17', // AS58593, Azure China, Shanghai
  '52.131.0.0/16', // AS58593, Azure China, Beijing
  '103.9.8.0/22', // AS58593, Azure China, Backbone
  '139.217.0.0/16', // AS58593, Azure China, Shanghai
  '139.219.0.0/16', // AS58593, Azure China, Shanghai
  '143.64.0.0/16', // AS58593, Azure China, Beijing
  '159.27.0.0/16', // AS58593, Azure China, Beijing
  '163.228.0.0/16' // AS58593, Azure China, Beijing
];
