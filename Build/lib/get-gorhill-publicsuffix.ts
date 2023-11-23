import { toASCII } from 'punycode';
import path from 'path';
import { traceAsync } from './trace-runner';
import { defaultRequestInit, fetchWithRetry } from './fetch-retry';
import type { PublicSuffixList } from 'gorhill-publicsuffixlist';

const publicSuffixPath = path.resolve(import.meta.dir, '../../node_modules/.cache/public_suffix_list_dat.txt');

const getGorhillPublicSuffix = () => traceAsync('create gorhill public suffix instance', async () => {
  const customFetch = async (url: string | URL) => Bun.file(url);

  const publicSuffixFile = Bun.file(publicSuffixPath);

  const [publicSuffixListDat, { default: gorhill }] = await Promise.all([
    await publicSuffixFile.exists()
      ? publicSuffixFile.text()
      : fetchWithRetry('https://publicsuffix.org/list/public_suffix_list.dat', defaultRequestInit).then(r => {
        console.log('public_suffix_list.dat not found, fetch directly from remote.');
        return r.text();
      }),
    import('gorhill-publicsuffixlist')
  ]);

  gorhill.parse(publicSuffixListDat, toASCII);
  await gorhill.enableWASM({ customFetch });

  return gorhill;
});

let gorhillPublicSuffixPromise: Promise<PublicSuffixList> | null = null;
export const getGorhillPublicSuffixPromise = () => {
  gorhillPublicSuffixPromise ||= getGorhillPublicSuffix();
  return gorhillPublicSuffixPromise;
};
