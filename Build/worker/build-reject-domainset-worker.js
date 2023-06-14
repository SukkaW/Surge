// @ts-check
const Piscina = require('piscina');
// const { isCI } = require('ci-info');
/** @type {string[]} */
const fullsetDomainStartsWithADot = Piscina.workerData
const totalLen = fullsetDomainStartsWithADot.length;

// const log = isCI ? () => { } : console.log.bind(console);
/**
 * @param {{ chunk: string[] }} param0
 */
module.exports = ({ chunk }) => {
  const chunkLength = chunk.length;
  const outputToBeRemoved = new Int8Array(chunkLength);

  for (let i = 0; i < chunkLength; i++) {
    const domainFromInputChunk = chunk[i];

    for (let j = 0; j < totalLen; j++) {
      const domainStartsWithADotAndFromFullSet = fullsetDomainStartsWithADot[j];
      // domainFromFullSet is always startsWith "."
      if (domainStartsWithADotAndFromFullSet === domainFromInputChunk) continue;

      const domainFromInputLen = domainFromInputChunk.length;
      const domainFromFullSetLen = domainStartsWithADotAndFromFullSet.length;

      if (domainFromInputLen < domainFromFullSetLen) {
        if (domainFromInputLen + 1 === domainFromFullSetLen) {
          // !domainFromInput.starsWith('.') && `.${domainFromInput}` === domainFromFullSet
          if (domainFromInputChunk.charCodeAt(0) !== 46 && domainFromInputChunk.endsWith(domainStartsWithADotAndFromFullSet)) {
            outputToBeRemoved[i] = 1;
            // log(domainFromInputChunk, domainStartsWithADotAndFromFullSet)
            break;
          }
        } else {
          break;
        }
      } else if (domainFromInputLen > domainFromFullSetLen && domainFromInputChunk.endsWith(domainStartsWithADotAndFromFullSet)) {
        outputToBeRemoved[i] = 1;
        // log(domainFromInputChunk, domainStartsWithADotAndFromFullSet)
        break;
      }
    }
  }

  return Piscina.move(outputToBeRemoved);
};
