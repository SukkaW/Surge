const Piscina = require('piscina');
const { canExcludeFromDedupe } = require('../lib/parse-filter')

const fullsetDomainStartsWithADot = Piscina.workerData
const totalLen = fullsetDomainStartsWithADot.length;

module.exports.dedupe = ({ chunk }) => {
  const chunkLength = chunk.length;
  const outputToBeRemoved = new Int8Array(chunkLength);

  for (let i = 0; i < chunkLength; i++) {
    const domainFromInput = chunk[i];

    if (canExcludeFromDedupe(domainFromInput)) {
      continue;
    }

    for (let j = 0; j < totalLen; j++) {
      const domainFromFullSet = fullsetDomainStartsWithADot[j];
      // domainFromFullSet is now startsWith a "."

      if (domainFromFullSet === domainFromInput) continue;

      const domainFromInputLen = domainFromInput.length;
      const domainFromFullSetLen = domainFromFullSet.length;

      // !domainFromInput.starsWith('.') && `.${domainFromInput}` === domainFromFullSet
      if (domainFromInput.charCodeAt(0) !== 46) {
        if (domainFromInputLen + 1 === domainFromFullSetLen) {

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
      } else if (domainFromInputLen > domainFromFullSetLen) {
        // domainFromInput is now startsWith a "."
        if (domainFromInput.endsWith(domainFromFullSet)) {
          outputToBeRemoved[i] = 1;
          break;
        }
      }
    }
  }

  return Piscina.move(outputToBeRemoved);
};
