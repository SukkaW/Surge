const { workerData, move } = require('piscina');

const len = workerData.length;
// pre check if fullset domain is starts with a "."
// This avoid calling chatCodeAt repeatedly
const fullsetDomainStartsWithADot = workerData.map(domain => domain.charCodeAt(0) === 46);

module.exports = ({ chunk }) => {
  const chunkLength = chunk.length;
  const outputToBeRemoved = new Int8Array(chunkLength);

  for (let i = 0; i < chunkLength; i++) {
    const domainFromInput = chunk[i];

    for (let j = 0; j < len; j++) {
      // Check if domainFromFullset starts with a "."
      if (!fullsetDomainStartsWithADot[j]) continue;
      // domainFromFullSet is now startsWith a "."

      const domainFromFullSet = workerData[j];

      if (domainFromFullSet === domainFromInput) continue;

      const domainFromInputLen = domainFromInput.length;

      if (domainFromInput.charCodeAt(0) !== 46) {
        let shouldBeRemoved = true;

        for (let k = 0; k < domainFromInputLen; k++) {
          if (domainFromFullSet.charCodeAt(k + 1) !== domainFromInput.charCodeAt(k)) {
            shouldBeRemoved = false;
            break;
          }
        }

        if (shouldBeRemoved) {
          outputToBeRemoved[i] = 1;
          break;
        }
      }
      // domainFromInput is now startsWith a "."

      if (domainFromInputLen >= domainFromFullSet.length) {
        if (domainFromInput.endsWith(domainFromFullSet)) {
          outputToBeRemoved[i] = 1;
          break;
        }
      }
    }
  }

  return move(outputToBeRemoved);
};
