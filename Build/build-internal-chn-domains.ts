import path from 'path';
import fsp from 'fs/promises'
import { parseFelixDnsmasq } from './lib/parse-dnsmasq';
import { task } from './lib/trace-runner';
import { compareAndWriteFile } from './lib/create-file';

export const buildInternalChnDomains = task(__filename, async () => {
  const [result] = await Promise.all([
    parseFelixDnsmasq('https://raw.githubusercontent.com/felixonmars/dnsmasq-china-list/master/accelerated-domains.china.conf'),
    fsp.mkdir(path.resolve(__dirname, '../List/internal'), { recursive: true })
  ]);

  return compareAndWriteFile(
    result.map(line => `SUFFIX,${line}`),
    path.resolve(__dirname, '../List/internal/accelerated-china-domains.txt')
  );
});

if (import.meta.main) {
  buildInternalChnDomains();
}
