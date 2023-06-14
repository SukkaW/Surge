// @ts-check
const { fetchWithRetry } = require('./fetch-retry');
const readline = require('readline');
const { Readable } = require('stream');

/**
 * @param {import('undici').RequestInfo} url
 * @param {import('undici').RequestInit | undefined} [opt]
 */
module.exports.fetchRemoteTextAndCreateReadlineInterface = async (url, opt) => {
  const resp = await fetchWithRetry(url, opt);
  if (!resp.body) {
    throw new Error('Failed to fetch remote text');
  }

  return readline.createInterface({
    input: Readable.fromWeb(resp.body),
    crlfDelay: Infinity
  });
}
