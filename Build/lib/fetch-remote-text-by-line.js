// @ts-check
const fs = require('fs');
const { fetchWithRetry } = require('./fetch-retry');
const readline = require('readline');
const { Readable } = require('stream');

/**
 * @param {string} path
 */
module.exports.readFileByLine = (path) => {
  return readline.createInterface({
    input: fs.createReadStream(path, { encoding: 'utf-8' }),
    crlfDelay: Infinity
  });
};

/**
 * @param {import('undici').Response} resp
 */
const createReadlineInterfaceFromResponse = (resp) => {
  if (!resp.body) {
    throw new Error('Failed to fetch remote text');
  }
  if (resp.bodyUsed) {
    throw new Error('Body has already been consumed.');
  }
  return readline.createInterface({
    input: Readable.fromWeb(resp.body),
    crlfDelay: Infinity
  });
};

module.exports.createReadlineInterfaceFromResponse = createReadlineInterfaceFromResponse;

/**
 * @param {import('undici').RequestInfo} url
 * @param {import('undici').RequestInit} [opt]
 */
module.exports.fetchRemoteTextAndCreateReadlineInterface = async (url, opt) => {
  const resp = await fetchWithRetry(url, opt);
  return createReadlineInterfaceFromResponse(resp);
};
