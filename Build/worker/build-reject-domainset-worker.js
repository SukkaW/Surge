const { workerData, move } = require('piscina');

// pre check if fullset domain is starts with a "."
// This avoid calling chatCodeAt repeatedly

// workerData is an array of string. Sort it by length, short first:
const fullsetDomainStartsWithADot = workerData.filter(domain => (
  domain.charCodeAt(0) === 46
  && !canExcludeFromDedupe(domain)
));
const totalLen = fullsetDomainStartsWithADot.length;

module.exports = ({ chunk }) => {
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
      }

      // domainFromInput is now startsWith a "."

      if (domainFromInputLen >= domainFromFullSetLen) {
        if (domainFromInput.endsWith(domainFromFullSet)) {
          outputToBeRemoved[i] = 1;
          break;
        }
      }
    }
  }

  return move(outputToBeRemoved);
};

// duckdns.org domain will not overlap and doesn't need dedupe
function canExcludeFromDedupe(domain) {
  if (domain.length === 23 && domain.endsWith('.duckdns.org')) {
    return true;
  }
  return false;
}
