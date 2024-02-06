import { toASCII } from 'punycode';
import { createMemoizedPromise } from './memo-promise';
import { getPublicSuffixListTextPromise } from '../download-publicsuffixlist';

const customFetch = (url: string | URL): Promise<Blob> => Promise.resolve(Bun.file(url));

export const getGorhillPublicSuffixPromise = createMemoizedPromise(async () => {
  const [publicSuffixListDat, { default: gorhill }] = await Promise.all([
    getPublicSuffixListTextPromise(),
    import('@gorhill/publicsuffixlist')
  ]);

  gorhill.parse(publicSuffixListDat, toASCII);
  await gorhill.enableWASM({ customFetch });

  return gorhill;
});
