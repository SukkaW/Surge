const { fetchWithRetry } = require('./lib/fetch-retry');
const { promises: fsPromises } = require('fs');
const { resolve: pathResolve } = require('path');

(async () => {
  console.time('Total Time - build-chnroutes-cidr');

  const cidr = (await (await fetchWithRetry('https://raw.githubusercontent.com/misakaio/chnroutes2/master/chnroutes.txt')).text()).split('\n');

  const filteredCidr = cidr.filter(line => {
    if (line) {
      return !line.startsWith('#')
    }

    return false;
  })

  await fsPromises.writeFile(pathResolve(__dirname, '../List/ip/china_ip.conf'), makeCidrList(filteredCidr), { encoding: 'utf-8' });

  console.timeEnd('Total Time - build-chnroutes-cidr');
})();

function makeCidrList(cidr) {
  const date = new Date();

  return `############################
# Mainland China IPv4 CIDR
# Data from misaka.io (misakaio @ GitHub)
# Last Updated: ${date.toISOString()}
# Routes: ${cidr.length}
############################\n` + cidr.map(i => `IP-CIDR,${i}`).join('\n') + '\n########### END ############\n';
};
