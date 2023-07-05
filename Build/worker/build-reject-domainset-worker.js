// @ts-check
const Piscina = require('piscina');
// const { isCI } = require('ci-info');
/** @type {string[]} */
const fullsetDomainStartsWithADot = Piscina.workerData
const totalLen = fullsetDomainStartsWithADot.length;

const DOT = '.';

// const log = isCI ? () => { } : console.log.bind(console);
/**
 * @param {{ chunk: string[] }} param0
 */
module.exports = ({ chunk }) => {
  const chunkLength = chunk.length;
  const outputToBeRemoved = new Int8Array(chunkLength);

  for (let i = 0; i < chunkLength; i++) {
    const domainFromInputChunk = chunk[i];
    const domainFromInputLen = domainFromInputChunk.length;

    for (let j = 0; j < totalLen; j++) {
      const domainStartsWithADotAndFromFullSet = fullsetDomainStartsWithADot[j];
      // domainFromFullSet is always startsWith "."
      if (domainStartsWithADotAndFromFullSet === domainFromInputChunk) continue;

      const domainFromFullSetLen = domainStartsWithADotAndFromFullSet.length;

      if (domainFromInputLen < domainFromFullSetLen) {
        if (domainFromInputLen + 1 !== domainFromFullSetLen) {
          continue;
        }

        // !domainFromInput.starsWith('.') && `.${domainFromInput}` === domainFromFullSet
        if (
          domainFromInputChunk[0] !== DOT
          && domainStartsWithADotAndFromFullSet.endsWith(domainFromInputChunk)
        ) {
          outputToBeRemoved[i] = 1;
          // log(domainFromInputChunk, domainStartsWithADotAndFromFullSet)
          break;
        }
      } else if (
        domainFromInputLen > domainFromFullSetLen
        && domainFromInputChunk.endsWith(domainStartsWithADotAndFromFullSet)
      ) {
        outputToBeRemoved[i] = 1;
        // log(domainFromInputChunk, domainStartsWithADotAndFromFullSet)
        break;
      }
    }
  }

  return Piscina.move(outputToBeRemoved);
};
