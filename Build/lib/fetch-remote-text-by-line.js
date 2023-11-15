// @ts-check
const { fetchWithRetry } = require('./fetch-retry');

const decoder = new TextDecoder('utf-8');
/**
 * @param {string} path
 */
module.exports.readFileByLine = async function *(path) {
  let buf = '';

  for await (const chunk of Bun.file(path).stream()) {
    const chunkStr = decoder.decode(chunk).replaceAll('\r\n', '\n');
    for (let i = 0, len = chunkStr.length; i < len; i++) {
      const char = chunkStr[i];
      if (char === '\n') {
        yield buf;
        buf = '';
      } else {
        buf += char;
      }
    }
  }

  if (buf) {
    yield buf;
  }
};

/**
 * @param {import('undici').Response} resp
 */
const createReadlineInterfaceFromResponse = async function *(resp) {
  if (!resp.body) {
    throw new Error('Failed to fetch remote text');
  }
  if (resp.bodyUsed) {
    throw new Error('Body has already been consumed.');
  }

  let buf = '';

  for await (const chunk of resp.body) {
    const chunkStr = decoder.decode(chunk).replaceAll('\r\n', '\n');
    for (let i = 0, len = chunkStr.length; i < len; i++) {
      const char = chunkStr[i];
      if (char === '\n') {
        yield buf;
        buf = '';
      } else {
        buf += char;
      }
    }
  }

  if (buf) {
    yield buf;
  }
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
