const Piscina = require('piscina');
const { isCI } = require('ci-info');

const fullsetDomainStartsWithADot = Piscina.workerData
const totalLen = fullsetDomainStartsWithADot.length;

const log = isCI ? () => { } : console.log.bind(console);

module.exports.dedupe = ({ chunk }) => {
  const chunkLength = chunk.length;
  const outputToBeRemoved = new Int8Array(chunkLength);

  for (let i = 0; i < chunkLength; i++) {
    const domainFromInput = chunk[i];

    for (let j = 0; j < totalLen; j++) {
      const domainFromFullSet = fullsetDomainStartsWithADot[j];
      // domainFromFullSet is always startsWith "."

      if (domainFromFullSet === domainFromInput) continue;

      const domainFromInputLen = domainFromInput.length;
      const domainFromFullSetLen = domainFromFullSet.length;

      // !domainFromInput.starsWith('.') && `.${domainFromInput}` === domainFromFullSet
      if (domainFromInput[0] !== '.' && domainFromInputLen + 1 === domainFromFullSetLen) {
        let shouldBeRemoved = true;

        for (let k = 0; k < domainFromInputLen; k++) {
          if (domainFromFullSet[k + 1] !== domainFromInput[k]) {
            shouldBeRemoved = false;
            break;
          }
        }

        if (shouldBeRemoved) {
          outputToBeRemoved[i] = 1;
          log(domainFromInput, domainFromFullSet)
          break;
        }
      }
      if (domainFromInputLen > domainFromFullSetLen) {
        // domainFromInput is now startsWith a "."
        if (domainFromInput.endsWith(domainFromFullSet)) {
          outputToBeRemoved[i] = 1;
          log(domainFromInput, domainFromFullSet)
          break;
        }
      }
    }
  }

  return Piscina.move(outputToBeRemoved);
};
