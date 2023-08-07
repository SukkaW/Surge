// @ts-check

/**
 * @param {string} title
 * @param {string[]} description
 * @param {Date} date
 * @param {string[]} content
 * @returns {string}
 */
// const withBanner = (title, description, date, content) => {
//   return `########################################
// # ${title}
// # Last Updated: ${date.toISOString()}
// # Size: ${content.length}
// ${description.map(line => (line ? `# ${line}` : '#')).join('\n')}
// ########################################\n${content.join('\n')}\n################# END ###################\n`;
// };

/**
 * @param {string} title
 * @param {string[]} description
 * @param {Date} date
 * @param {string[]} content
 * @returns {string[]}
 */
const withBannerArray = (title, description, date, content) => {
  return [
    '########################################',
    `# ${title}`,
    `# Last Updated: ${date.toISOString()}`,
    `# Size: ${content.length}`,
    ...description.map(line => (line ? `# ${line}` : '#')),
    '########################################',
    ...content,
    '################# END ###################',
    ''
  ];
};

// module.exports.withBanner = withBanner;
module.exports.withBannerArray = withBannerArray;
