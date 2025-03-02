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
  'sa.com', 'sbs', 'science', 'shop', 'site', 'skin', 'space', 'store', 'stream', 'su', 'surf',
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
  // 'notion.site',
  // 'vercel.app',
  'gitbook.io',
  'zendesk.com',
  'ipfs.eth.aragon.network',
  'wordpress.com'
]);

export const leathalKeywords = createKeywordFilter([
  'vinted-',
  'inpost-pl',
  'vlnted-',
  'allegrolokalnie',
  'thetollroads',
  'getipass',

  // Fake TLD
  '.pl-',
  '.com-',
  '.net-',
  '.org-',
  '.gov-'
]);

export const sensitiveKeywords = createKeywordFilter([
  '.amazon-',
  '-amazon',
  'fb-com',
  'facebook-com',
  '-facebook',
  'facebook-',
  'focebaak',
  '.facebook.',
  'metamask',
  'www.apple',
  '-coinbase',
  'coinbase-',
  'booking-com',
  'booking.com-',
  'booking-eu',
  'vinted-',
  'inpost-pl',
  'login.microsoft',
  'login-microsoft',
  'microsoftonline',
  'google.com-',
  'minecraft',
  'staemco',
  'oferta',
  'txtag'
]);

export const lowKeywords = createKeywordFilter([
  'transactions-',
  'payment',
  'wallet',
  '-transactions',
  '-faceb', // facebook fake
  '.faceb', // facebook fake
  'facebook',
  'virus-',
  'icloud-',
  'apple-',
  '-roblox',
  '-co-jp',
  'customer.',
  'customer-',
  '.www-',
  '.www.',
  '.www2',
  'instagram',
  'microsof',
  'passwordreset',
  '.google-',
  'recover',
  'banking',
  'shop'
]);
