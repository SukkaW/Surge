import path from 'path';
import fsp from 'fs/promises'
import { parseFelixDnsmasq } from './lib/parse-dnsmasq';
import { task } from './lib/trace-runner';
import { compareAndWriteFile } from './lib/create-file';

export const buildInternalChnDomains = task(import.meta.path, async () => {
  const [result] = await Promise.all([
    parseFelixDnsmasq('https://raw.githubusercontent.com/felixonmars/dnsmasq-china-list/master/accelerated-domains.china.conf'),
    fsp.mkdir(path.resolve(import.meta.dir, '../List/internal'), { recursive: true })
  ]);

  return compareAndWriteFile(
    result.map(line => `SUFFIX,${line}`),
    path.resolve(import.meta.dir, '../List/internal/accelerated-china-domains.txt')
  );
});

if (import.meta.main) {
  buildInternalChnDomains();
}
