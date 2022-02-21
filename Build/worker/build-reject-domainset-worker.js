exports.dedupe = ({ fullSet, input }) => {
  const outputToBeRemoved = new Set();

  for (const domainFromInput of input) {
    for (const domainFromFullSet of fullSet) {
      if (
        domainFromFullSet.startsWith('.')
        && domainFromFullSet !== domainFromInput
        && (
          domainFromInput.endsWith(domainFromFullSet)
          || `.${domainFromInput}` === domainFromFullSet
        )
      ) {
        outputToBeRemoved.add(domainFromInput);
        break;
      }
    }
  }

  return outputToBeRemoved;
};

exports.whitelisted = ({ whiteList, input }) => {
  const outputToBeRemoved = new Set();

  for (const domain of input) {
    for (const white of whiteList) {
      if (domain.includes(white) || white.includes(domain)) {
        outputToBeRemoved.add(domain);
        break;
      }
    }
  }

  return outputToBeRemoved;
};

exports.dedupeKeywords = ({ keywords, suffixes, input }) => {
  const outputToBeRemoved = new Set();

  for (const domain of input) {
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
