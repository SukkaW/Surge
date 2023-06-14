// @ts-check
const { fetch } = require('undici');
const fetchWithRetry = /** @type {fetch} */(require('@vercel/fetch-retry')(fetch));
module.exports.fetchWithRetry = fetchWithRetry;
