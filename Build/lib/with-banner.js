/**
 * @param {string} title
 * @param {string[]} description
 * @param {Date} date
 * @param {string[]} content
 * @returns {string}
 */
const withBanner = (title, description, date, content) => {
    return `########################################
# ${title}
${description.map(line => `# ${line}`).join('\n')}
# Last Updated: ${date.toISOString()}
# Size: ${content.length}
########################################\n` + content.join('\n') + '\n################# END ###################\n';
};

module.exports.withBanner = withBanner;
