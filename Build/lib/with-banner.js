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
// module.exports.withBanner = withBanner;

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

module.exports.withBannerArray = withBannerArray;
