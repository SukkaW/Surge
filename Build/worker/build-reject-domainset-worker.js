const { workerData } = require('piscina');

const len = workerData.length;

exports.dedupe = ({ chunk }) => {
  const outputToBeRemoved = new Set();

  for (let i = 0, l = chunk.length; i < l; i++) {
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
          outputToBeRemoved.add(domainFromInput);
          break;
        }
      }
      // domainFromInput is now startsWith a "."

      if (domainFromInput.length >= domainFromFullSet.length) {
        if (domainFromInput.endsWith(domainFromFullSet)) {
          outputToBeRemoved.add(domainFromInput);
          break;
        }
      }
    }
  }

  return outputToBeRemoved;
};
