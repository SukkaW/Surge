const { simpleGet } = require('./util-http-get');
const { promises: fsPromises } = require('fs');
const { resolve: pathResolve } = require('path');

(async () => {
  const cidr = (await simpleGet.https('raw.githubusercontent.com', 'misakaio/chnroutes2/master/chnroutes.txt')).split('\n');

  const filteredCidr = cidr.filter(line => {
    if (line) {
      return !line.startsWith('#')
    }

    return false;
  })

  return fsPromises.writeFile(pathResolve(__dirname, '../List/ip/china_ip.conf'), makeCidrList(filteredCidr), { encoding: 'utf-8' });
})();

function makeCidrList(cidr) {
  const date = new Date();

  return `############################
# Mainland China IPv4 CIDR
# Data from vx.link (tmplink @ GitHub)
# Last Updated: ${date.getFullYear()}-${date.getUTCMonth() + 1}-${date.getUTCDate()} ${date.getUTCHours()}:${date.getUTCMinutes()}:${date.getUTCSeconds()}
# Routes: ${cidr.length}
############################\n` + cidr.map(i => `IP-CIDR,${i}`).join('\n') + '\n########### END ############\n';
};
