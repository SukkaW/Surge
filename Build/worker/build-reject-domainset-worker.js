const { workerData, move } = require('piscina');

const len = workerData.length;

module.exports = ({ chunk }) => {
  const chunkLength = chunk.length;
  const outputToBeRemoved = new Int32Array(chunkLength);

  for (let i = 0; i < chunkLength; i++) {
    const domainFromInput = chunk[i];

    for (let j = 0; j < len; j++) {
      const domainFromFullSet = workerData[j];

      if (domainFromFullSet === domainFromInput) continue;
      if (domainFromFullSet.charCodeAt(0) !== 46) continue;
      // domainFromFullSet is now startsWith a "."

      if (domainFromInput.charCodeAt(0) !== 46) {
        let shouldBeRemoved = true;

        for (let k = 0, l2 = domainFromInput.length; k < l2; k++) {
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

      if (domainFromInput.length >= domainFromFullSet.length) {
        if (domainFromInput.endsWith(domainFromFullSet)) {
          outputToBeRemoved[i] = 1;
          break;
        }
      }
    }
  }

  return move(outputToBeRemoved);
};
