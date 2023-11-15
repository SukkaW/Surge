import { toASCII } from 'punycode';
import path from 'path';
import { traceAsync } from './trace-runner';
import type { PublicSuffixList } from 'gorhill-publicsuffixlist';

const publicSuffixPath = path.resolve(__dirname, '../../node_modules/.cache/public_suffix_list_dat.txt');

const getGorhillPublicSuffix = () => traceAsync('create gorhill public suffix instance', async () => {
  const customFetch = async (url: string | URL) => Bun.file(url);

  const publicSuffixFile = Bun.file(publicSuffixPath);

  const [publicSuffixListDat, { default: gorhill }] = await Promise.all([
    await publicSuffixFile.exists()
      ? publicSuffixFile.text()
      : fetch('https://publicsuffix.org/list/public_suffix_list.dat').then(r => {
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
