exports.dedupe = ({ fullSet, input }) => {
  const output = new Set();

  for (const domain of input) {
    for (const domain2 of fullSet) {
      if (
        domain2.startsWith('.')
        && domain2 !== domain
        && (
          domain.endsWith(domain2)
          || `.${domain}` === domain2
        )
      ) {
        output.add(domain);
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

exports.dedupeKeywords = ({ keywords, input }) => {
  const output = new Set();

  for (const domain of input) {
    for (const keyword of keywords) {
      if (domain.includes(keyword) || keyword.includes(domain)) {
        output.add(domain);
        break;
      }
    }
  }

  return output;
}
