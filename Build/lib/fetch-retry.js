// @ts-check
const undici = require('undici');

// Enable HTTP/2 supports
undici.setGlobalDispatcher(new undici.Agent({
  allowH2: true,
  pipelining: 10
}));

const fetchWithRetry = /** @type {import('undici').fetch} */(require('@vercel/fetch-retry')(undici.fetch));
module.exports.fetchWithRetry = fetchWithRetry;
