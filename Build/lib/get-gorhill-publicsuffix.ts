import { toASCII } from 'punycode';
import { createMemoizedPromise } from './memo-promise';
import { getPublicSuffixListTextPromise } from './download-publicsuffixlist';

const customFetch = typeof Bun !== 'undefined'
  ? (url: string | URL) => Promise.resolve(Bun.file(url))
  : (url: string | URL) => fetch(url).then(resp => resp.blob() as Promise<Blob>);

export const getGorhillPublicSuffixPromise = createMemoizedPromise(async () => {
  const [publicSuffixListDat, { default: gorhill }] = await Promise.all([
    getPublicSuffixListTextPromise(),
    import('@gorhill/publicsuffixlist')
  ]);

  gorhill.parse(publicSuffixListDat, toASCII);
  await gorhill.enableWASM({ customFetch });

  return gorhill;
});
