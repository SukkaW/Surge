exports.dedupe = ({ fullSet, input }) => {
  const output = new Set();

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
        output.add(domainFromInput);
        break;
      }
    }
  }

  return output;
};

exports.whitelisted = ({ whiteList, input }) => {
  const output = new Set();

  for (const domain of input) {
    for (const white of whiteList) {
      if (domain.includes(white) || white.includes(domain)) {
        output.add(domain);
        break;
      }
    }
  }

  return output;
};

exports.dedupeKeywords = ({ keywords, suffixes, input }) => {
  const output = new Set();

  for (const domain of input) {
    for (const keyword of keywords) {
      if (domain.includes(keyword) || keyword.includes(domain)) {
        output.add(domain);
        break;
      }
    }
    for (const suffix of suffixes) {
      if (domain.endsWith(suffix)) {
        output.add(domain);
        break;
      }
    }
  }

  return output;
}
