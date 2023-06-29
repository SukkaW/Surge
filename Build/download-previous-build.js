const { fetch } = require('undici');
const tar = require('tar');
const fs = require('fs');
const fse = require('fs-extra');
const { join, resolve } = require('path');
const { tmpdir } = require('os');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');

const fileExists = (path) => {
  return fs.promises.access(path, fs.constants.F_OK)
    .then(() => true)
    .catch(() => false);
};

(async () => {
  const filesList = (await fs.promises.readFile(resolve(__dirname, '../.gitignore'), { encoding: 'utf-8' }))
    .split('\n')
    .filter(p => p.startsWith('List/') && !p.endsWith('/'));

  if (
    !((await Promise.all(
      filesList.map(p => fileExists(join(__dirname, '..', p)))
    )).some(exist => !exist))
  ) {
    console.log('All files exists, skip download.');
    return;
  }

  const tempFile = join(tmpdir(), `sukka-surge-last-build-tar-${Date.now()}`);
  const resp = await fetch('https://codeload.github.com/sukkaw/surge/tar.gz/gh-pages');
  const readableNodeStream = Readable.fromWeb(resp.body);
  await pipeline(
    readableNodeStream,
    fs.createWriteStream(tempFile)
  );

  const extractedPath = join(tmpdir(), `sukka-surge-last-build-extracted-${Date.now()}`);
  await fse.ensureDir(extractedPath);
  await tar.x({
    file: tempFile,
    cwd: extractedPath,
    filter: (p) => {
      return p.split('/')[1] === 'List'
    }
  });

  await Promise.all(filesList.map(p => fse.copy(
    join(extractedPath, 'Surge-gh-pages', p),
    join(__dirname, '..', p),
    {
      overwrite: true
    }
  )))

  await fs.promises.unlink(tempFile).catch(() => { });
  await fs.promises.unlink(extractedPath).catch(() => { });
})();
