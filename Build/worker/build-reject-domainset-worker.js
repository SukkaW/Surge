// @ts-check
const Piscina = require('piscina');
const Trie = require('../lib/trie');
// const { isCI } = require('ci-info');
/** @type {string[]} */
const fullsetDomainStartsWithADot = Piscina.workerData;
const totalLen = fullsetDomainStartsWithADot.length;

const DOT = '.';

// const log = isCI ? () => { } : console.log.bind(console);
/**
 * @param {{ chunk: string[] }} param0
 */
module.exports = ({ chunk }) => {
  const chunkLength = chunk.length;
  const outputToBeRemoved = new Int8Array(chunkLength);

  const trie = Trie.from(chunk);

  for (let j = 0; j < totalLen; j++) {
    const domainStartsWithADotAndFromFullSet = fullsetDomainStartsWithADot[j];

    const found = trie.find(domainStartsWithADotAndFromFullSet, false)

    if (found.length) {
      found.forEach(f => {
        const index = chunk.indexOf(f);
        if (index !== -1) {
          outputToBeRemoved[index] = 1;
        }
      })
    }

    const a = domainStartsWithADotAndFromFullSet.slice(1);
    if (trie.has(a)) {
      const index = chunk.indexOf(a);
      if (index !== -1) {
        outputToBeRemoved[index] = 1;
      }
    }
  }

  return Piscina.move(outputToBeRemoved);
};
