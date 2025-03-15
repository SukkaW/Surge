import { createRetrieKeywordFilter as createKeywordFilter } from 'foxts/retrie';

export const BLACK_TLD = new Set([
  'accountant', 'art', 'autos',
  'bar', 'beauty', 'bid', 'bio', 'biz', 'bond', 'business', 'buzz',
  'cc', 'cf', 'cfd', 'click', 'cloud', 'club', 'cn', 'codes',
  'co.uk', 'co.in', 'com.br', 'com.cn', 'com.pl', 'com.vn',
  'cool', 'cricket', 'cyou',
  'date', 'design', 'digital', 'download',
  'faith', 'fit', 'fun',
  'ga', 'gd', 'gives', 'gq', 'group', 'host',
  'icu', 'id', 'info', 'ink',
  'lat', 'life', 'live', 'link', 'loan', 'lol', 'ltd',
  'me', 'men', 'ml', 'mobi', 'mom', 'monster',
  'net.pl',
  'one', 'online',
  'party', 'pro', 'pl', 'pw',
  'racing', 'rest', 'review', 'rf.gd',
  'sa.com', 'sbs', 'science', 'shop', 'site', 'skin', 'space', 'store', 'stream', 'su', 'support', 'surf',
  'tech', 'tk', 'tokyo', 'top', 'trade',
  'vip', 'vn',
  'webcam', 'website', 'win',
  'xyz',
  'za.com'
]);

export const WHITELIST_MAIN_DOMAINS = new Set([
  // 'w3s.link', // ipfs gateway
  // 'dweb.link', // ipfs gateway
  // 'nftstorage.link', // ipfs gateway
  'fleek.cool', // ipfs gateway
  'flk-ipfs.xyz', // ipfs gateway
  'business.site', // Drag'n'Drop site building platform
  'page.link', // Firebase URL Shortener
  // 'notion.site', d
  // 'vercel.app',
  'gitbook.io',
  'zendesk.com',
  'ipfs.eth.aragon.network',
  'wordpress.com',
  'cloud.microsoft' // actually owned by Microsoft
]);

export const leathalKeywords = createKeywordFilter([
  'vinted-',
  'inpost-pl',
  'vlnted-',
  'allegrolokalnie',
  'thetollroads',
  'getipass',
  '.secure.txtag',

  // Fake TLD
  '.pl-',
  '-pl.',
  '.com-',
  '-com.',
  '.net-',
  '.org-',
  '.gov-',
  '-gov.',
  '.au-',
  '.co.uk-',
  '.de-',
  '.eu-',
  '.us-',
  '.uk-',
  '.ru-'
]);

export const sensitiveKeywords = createKeywordFilter([
  'amazon',
  'fb-com',
  'focebaak',
  'facebook',
  'metamask',
  'apple',
  'icloud',
  'coinbase',
  'booking.',
  'booking-',
  'vinted.',
  'vinted-',
  'inpost-pl',
  'microsoft',
  'google',
  'minecraft',
  'staemco',
  'oferta',
  'txtag',
  'paypal',
  'dropbox',
  'payment',
  'instagram'
]);

export const lowKeywords = createKeywordFilter([
  'transactions',
  'wallet',
  '-faceb', // facebook fake
  '.faceb', // facebook fake
  'virus-',
  '-roblox',
  '-co-jp',
  'customer.',
  'customer-',
  '.www-',
  '.www.',
  '.www2',
  'microsof',
  'password',
  'recover',
  'banking',
  'shop'
]);
