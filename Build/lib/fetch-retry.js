// @ts-check
const fetchWithRetry = require('@vercel/fetch-retry')(fetch);
module.exports.fetchWithRetry = fetchWithRetry;
