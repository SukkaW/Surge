import fsp from 'fs/promises';
import { toASCII } from 'punycode/punycode';
import { createMemoizedPromise } from './memo-promise';
import { getPublicSuffixListTextPromise } from './download-publicsuffixlist';
import { fileURLToPath } from 'url';

const customFetch = typeof Bun !== 'undefined'
  ? (url: string | URL) => Promise.resolve(Bun.file(url))
  : async (url: string | URL) => {
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
