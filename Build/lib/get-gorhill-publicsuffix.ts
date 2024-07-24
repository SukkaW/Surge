import fsp from 'fs/promises';
import { toASCII } from 'punycode/punycode';
import { createMemoizedPromise } from './memo-promise';
import { getPublicSuffixListTextPromise } from './download-publicsuffixlist';
import { fileURLToPath } from 'url';

// TODO: node undfici fetch doesn't support file URL reading yet
const customFetch = async (url: URL) => {
  const filePath = fileURLToPath(url);
  const file = await fsp.readFile(filePath);
  return new Blob([file]) as any;
};

export const getGorhillPublicSuffixPromise = createMemoizedPromise(async () => {
  const [publicSuffixListDat, { default: gorhill }] = await Promise.all([
    getPublicSuffixListTextPromise(),
    import('@gorhill/publicsuffixlist')
  ]);

  gorhill.parse(publicSuffixListDat, toASCII);
  await gorhill.enableWASM({ customFetch });

  return gorhill;
});
