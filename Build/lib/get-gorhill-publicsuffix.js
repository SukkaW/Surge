const { toASCII } = require('punycode/');
const fs = require('fs');
const path = require('path');

const publicSuffixPath = path.resolve(__dirname, '../../node_modules/.cache/public_suffix_list_dat.txt');

const getGorhillPublicSuffix = async () => {
  const customFetch = async (url) => {
    const buf = await fs.promises.readFile(url);
    return {
      arrayBuffer() { return Promise.resolve(buf.buffer); }
    };
  };

  const [publicSuffixListDat, { default: gorhill }] = await Promise.all([
    fs.existsSync(publicSuffixPath)
      ? fs.promises.readFile(publicSuffixPath, 'utf-8')
      : fetch('https://publicsuffix.org/list/public_suffix_list.dat').then(r => {
        console.log('public_suffix_list.dat not found, fetch directly from remote.');
        return r.text();
      }),
    import('gorhill-publicsuffixlist')
  ]);

  gorhill.parse(publicSuffixListDat, toASCII);
  await gorhill.enableWASM({ customFetch });

  return gorhill;
};

/** @type {Promise<import('gorhill-publicsuffixlist').default> | null} */
let gorhillPublicSuffixPromise = null;
module.exports.getGorhillPublicSuffixPromise = () => {
  gorhillPublicSuffixPromise ||= getGorhillPublicSuffix();
  return gorhillPublicSuffixPromise;
};
