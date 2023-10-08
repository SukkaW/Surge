const { fetch } = require('undici');
const tar = require('tar');
const fs = require('fs');
const fsp = fs.promises;
const fse = require('fs-extra');
const path = require('path');
const { tmpdir } = require('os');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');
const { readFileByLine } = require('./lib/fetch-remote-text-by-line');
const { isCI } = require('ci-info');
const { task, traceAsync } = require('./lib/trace-runner');

const fileExists = (path) => {
  return fs.promises.access(path, fs.constants.F_OK)
    .then(() => true)
    .catch(() => false);
};

const downloadPreviousBuild = task(__filename, async () => {
  const filesList = ['Clash', 'List'];

  let allFileExists = true;

  for await (const line of readFileByLine(path.resolve(__dirname, '../.gitignore'))) {
    if (
      (
        // line.startsWith('List/')
        line.startsWith('Modules/')
      ) && !line.endsWith('/')
    ) {
      filesList.push(line);

      if (!isCI) {
        allFileExists = fs.existsSync(path.join(__dirname, '..', line));
        if (!allFileExists) {
          break;
        }
      }
    }
  }

  if (isCI) {
    allFileExists = false;
  }

  if (allFileExists) {
    console.log('All files exists, skip download.');
    return;
  }

  const extractedPath = path.join(tmpdir(), `sukka-surge-last-build-extracted-${Date.now()}`);

  await traceAsync(
    'Download and extract previous build',
    () => Promise.all([
      fetch('https://codeload.github.com/sukkalab/ruleset.skk.moe/tar.gz/master'),
      fsp.mkdir(extractedPath, { recursive: true })
    ]).then(([resp]) => pipeline(
      Readable.fromWeb(resp.body),
      tar.x({
        cwd: extractedPath,
        filter(p) {
          return p.includes('/List/') || p.includes('/Modules/') || p.includes('/Clash/');
        }
      })
    ))
  );

  console.log('Files list:', filesList);

  await Promise.all(filesList.map(async p => {
    const src = path.join(extractedPath, 'ruleset.skk.moe-master', p);
    if (await fileExists(src)) {
      return fse.copy(
        src,
        path.join(__dirname, '..', p),
        { overwrite: true }
      );
    }
  }));

  // return fs.promises.unlink(extractedPath).catch(() => { });
});

const downloadPublicSuffixList = task(__filename, async () => {
  const publicSuffixDir = path.resolve(__dirname, '../node_modules/.cache');
  const publicSuffixPath = path.join(publicSuffixDir, 'public_suffix_list_dat.txt');

  const [resp] = await Promise.all([
    fetch('https://publicsuffix.org/list/public_suffix_list.dat'),
    fsp.mkdir(publicSuffixDir, { recursive: true })
  ]);

  return pipeline(
    Readable.fromWeb(resp.body),
    fs.createWriteStream(publicSuffixPath)
  );
}, 'download-publicsuffixlist');

module.exports.downloadPreviousBuild = downloadPreviousBuild;
module.exports.downloadPublicSuffixList = downloadPublicSuffixList;

if (require.main === module) {
  Promise.all([
    downloadPreviousBuild(),
    downloadPublicSuffixList()
  ]);
}
