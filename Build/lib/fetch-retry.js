const { fetch } = require('undici');
const fetchWithRetry = require('@vercel/fetch-retry')(fetch);
module.exports.fetchWithRetry = fetchWithRetry;
