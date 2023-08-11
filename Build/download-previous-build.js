const { fetch } = require('undici');
const tar = require('tar');
const fs = require('fs');
const fse = require('fs-extra');
const { join, resolve } = require('path');
const { tmpdir } = require('os');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');
const { readFileByLine } = require('./lib/fetch-remote-text-by-line');

const fileExists = (path) => {
  return fs.promises.access(path, fs.constants.F_OK)
    .then(() => true)
    .catch(() => false);
};

(async () => {
  const filesList = [];

  for await (const line of readFileByLine(resolve(__dirname, '../.gitignore'))) {
    if (line.startsWith('List/') && !line.endsWith('/')) {
      filesList.push(line);
    }
  }

  if (
    !((await Promise.all(
      filesList.map(p => fileExists(join(__dirname, '..', p)))
    )).some(exist => !exist))
  ) {
    console.log('All files exists, skip download.');
    return;
  }

  const extractedPath = join(tmpdir(), `sukka-surge-last-build-extracted-${Date.now()}`);

  const [resp] = await Promise.all([
    fetch('https://codeload.github.com/sukkaw/surge/tar.gz/gh-pages'),
    fse.ensureDir(extractedPath)
  ]);

  await pipeline(
    Readable.fromWeb(resp.body),
    tar.x({
      cwd: extractedPath,
      filter(p) {
        return p.split('/')[1] === 'List';
      }
    })
  );

  await Promise.all(filesList.map(async p => {
    const src = join(extractedPath, 'Surge-gh-pages', p);
    if (await fileExists(src)) {
      return fse.copy(
        src,
        join(__dirname, '..', p),
        { overwrite: true }
      );
    }
  }));

  await fs.promises.unlink(extractedPath).catch(() => { });
})();
