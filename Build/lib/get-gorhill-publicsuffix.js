const { toASCII } = require('punycode/');
const fs = require('fs');
const path = require('path');

const publicSuffixPath = path.resolve(__dirname, '../../node_modules/.cache/public_suffix_list_dat.txt');
const getPublicSuffixListDat = () => {
  if (fs.existsSync(publicSuffixPath)) {
    return fs.promises.readFile(publicSuffixPath, 'utf-8');
  }
  console.log('public_suffix_list.dat not found, fetch directly from remote.');
  return fetch('https://publicsuffix.org/list/public_suffix_list.dat').then(r => r.text());
};

const getGorhillPublicSuffix = async () => {
  const customFetch = async (url) => {
    const buf = await fs.promises.readFile(url);
    return {
      arrayBuffer() { return Promise.resolve(buf.buffer); }
    };
  };

  const [publicSuffixListDat, { default: gorhill }] = await Promise.all([
    getPublicSuffixListDat(),
    import('gorhill-publicsuffixlist')
  ]);

  gorhill.parse(publicSuffixListDat, toASCII);
  await gorhill.enableWASM({ customFetch });

  return gorhill;
};

const getGorhillPublicSuffixPromise = getGorhillPublicSuffix();
module.exports.getGorhillPublicSuffixPromise = getGorhillPublicSuffixPromise;
