const { workerData } = require('piscina');

exports.dedupe = ({ chunk }) => {
  const outputToBeRemoved = new Set();

  for (let i = 0, l = chunk.length; i < l; i++) {
    const domainFromInput = chunk[i];
    for (const domainFromFullSet of workerData) {
      if (outputToBeRemoved.has(domainFromFullSet)) continue;
      if (domainFromFullSet === domainFromInput) continue;
      if (domainFromFullSet.charAt(0) !== '.') continue;
      // domainFromFullSet is now startsWith a "."

      if (domainFromInput.charAt(0) !== '.') {
        let shouldBeRemoved = true;

        for (let j = 0, l2 = domainFromInput.length; j < l2; j++) {
          if (domainFromFullSet.charAt(j + 1) !== domainFromInput.charAt(j)) {
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

exports.whitelisted = ({ whiteList }) => {
  const outputToBeRemoved = new Set();

  for (const domain of workerData) {
    for (const white of whiteList) {
      if (domain.includes(white) || white.includes(domain)) {
        outputToBeRemoved.add(domain);
        break;
      }
    }
  }

  return outputToBeRemoved;
};

exports.dedupeKeywords = ({ keywords, suffixes }) => {
  const outputToBeRemoved = new Set();

  for (const domain of workerData) {
    for (const keyword of keywords) {
      if (domain.includes(keyword) || keyword.includes(domain)) {
        outputToBeRemoved.add(domain);
        break;
      }
    }
    for (const suffix of suffixes) {
      if (domain.endsWith(suffix)) {
        outputToBeRemoved.add(domain);
        break;
      }
    }
  }

  return outputToBeRemoved;
}
