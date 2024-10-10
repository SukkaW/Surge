import path from 'node:path';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import zlib from 'node:zlib';
import process from 'node:process';

import { async as ezspawn } from '@jsdevtools/ez-spawn';
import { mkdirp } from './misc';
import { $fetch } from './make-fetch-happen';

const mihomoBinaryDir = path.join(__dirname, '../../node_modules/.cache/mihomo');
const mihomoBinaryPath = path.join(mihomoBinaryDir, 'mihomo');

const mihomoBinaryUrl: Partial<Record<NodeJS.Platform, Partial<Record<NodeJS.Architecture, string>>>> = {
  linux: {
    x64: 'https://github.com/MetaCubeX/mihomo/releases/download/v1.18.7/mihomo-linux-amd64-compatible-v1.18.7.gz'
  },
  darwin: {
    x64: 'https://github.com/MetaCubeX/mihomo/releases/download/v1.18.7/mihomo-darwin-amd64-v1.18.7.gz',
    arm64: 'https://github.com/MetaCubeX/mihomo/releases/download/v1.18.7/mihomo-darwin-arm64-v1.18.7.gz'
  }
};

async function ensureMihomoBinary() {
  await mkdirp(mihomoBinaryDir);
  if (!fs.existsSync(mihomoBinaryPath)) {
    const writeStream = fs.createWriteStream(mihomoBinaryPath);

    const downloadUrl = mihomoBinaryUrl[process.platform]?.[process.arch];
    if (!downloadUrl) {
      throw new Error(`Unsupported platform: ${process.platform} ${process.arch}`);
    }

    const res = await $fetch(downloadUrl);

    if (!res.ok || !res.body) {
      throw new Error(`Failed to download mihomo binary: ${res.statusText}`);
    }

    const gunzip = zlib.createGunzip();

    await pipeline(
      res.body,
      gunzip,
      writeStream
    );
  }
  await fsp.chmod(mihomoBinaryPath, 0o755);
}

export async function convertClashMetaMrs(type: 'domain', format: 'text', input: string, output: string) {
  await ensureMihomoBinary();

  const { stderr } = await ezspawn(mihomoBinaryPath, ['convert-ruleset', type, format, input, output]);

  if (stderr) {
    throw new Error(stderr);
  }
}
