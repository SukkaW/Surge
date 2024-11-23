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
// https://github.com/misakaio/chnroutes2/issues/48
export const CN_CIDR_MISSING_IN_CHNROUTE = [
  // Baidu Public DNS
  '180.76.76.0/24',
  // Ali Public DNS
  '223.5.5.0/24',
  '223.6.6.0/24',
  // Tencent DNSPod Public DNS
  '119.29.29.0/24',
  '119.28.28.0/24',
  '120.53.53.0/24',
  '1.12.12.0/24',
  '1.12.34.0/24',
  // ByteDance Public DNS
  '180.184.1.0/24',
  '180.184.2.0/24',
  // 360 Public DNS
  '101.198.198.0/24',
  '101.198.199.0/24',

  // ChinaTelecom
  '103.7.141.0/24', // Hubei

  // Aliyun Shenzhen
  '120.78.0.0/16',

  // wy.com.cn
  '211.99.96.0/19',

  // AS58593, Azure China
  '40.72.0.0/15', // Shanghai
  '42.159.0.0/16', // Shanghai
  '52.130.0.0/17', // Shanghai
  '52.131.0.0/16', // Beijing
  '103.9.8.0/22', // Backbone
  '139.217.0.0/16', // Shanghai
  '139.219.0.0/16', // Shanghai
  '143.64.0.0/16', // Beijing
  '159.27.0.0/16', // Beijing
  '163.228.0.0/16', // Beijing

  // NetEase
  '223.252.194.0/24',
  '223.252.196.0/24',

  // Xiamen Kuaikuai
  '180.188.36.0/22' // no route globally
];
