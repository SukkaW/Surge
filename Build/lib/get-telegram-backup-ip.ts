// https://reserve-5a846.firebaseio.com/ipconfigv3.json
// apv3.stel.com tapv3.stel.com
import { Buffer } from 'node:buffer';
import crypto from 'node:crypto';
import { Api, extensions as TgExtensions } from 'telegram';
import { bigint2ip } from 'fast-cidr-tools';

import { base64ToUint8Array, concatUint8Arrays } from 'foxts/uint8array-utils';

import Worktank from 'worktank';
import { wait } from 'foxts/wait';
import { once } from 'foxts/once';

const mtptoto_public_rsa = `-----BEGIN RSA PUBLIC KEY-----
MIIBCgKCAQEAyr+18Rex2ohtVy8sroGP
BwXD3DOoKCSpjDqYoXgCqB7ioln4eDCFfOBUlfXUEvM/fnKCpF46VkAftlb4VuPD
eQSS/ZxZYEGqHaywlroVnXHIjgqoxiAd192xRGreuXIaUKmkwlM9JID9WS2jUsTp
zQ91L8MEPLJ/4zrBwZua8W5fECwCCh2c9G5IzzBm+otMS/YKwmR1olzRCyEkyAEj
XWqBI9Ftv5eG8m0VkBzOG655WIYdyV0HfDK/NWcvGqa0w/nriMD6mDjKOryamw0O
P9QuYgMN0C9xMW9y8SmP4h92OAWodTYgY1hZCxdv6cs5UnW9+PWvS+WIbkh+GaWY
xwIDAQAB
-----END RSA PUBLIC KEY-----
`;

export function getTelegramBackupIPFromBase64(base64: string) {
  // 1. Check base64 size
  if (base64.length !== 344) {
    throw new TypeError('Invalid base64 length');
  }

  // 2. Filter to base64 and check length
  // Not needed with base64ToUint8Array, it has built-in base64-able checking

  // 3. Decode base64 to Buffer
  const decoded = base64ToUint8Array(base64);
  if (decoded.length !== 256) {
    throw new TypeError('Decoded buffer length is not 344 bytes, received ' + decoded.length);
  }

  // 4. RSA decrypt (public key, "decrypt signature" - usually means "verify and extract")
  // In Node.js, publicDecrypt is used for signature verification (Note that no padding is needed)
  const publicKey = crypto.createPublicKey(mtptoto_public_rsa);
  const decrypted = crypto.publicDecrypt(
    {
      key: publicKey,
      padding: crypto.constants.RSA_NO_PADDING
    },
    decoded
  );

  // 5. Extract AES key/iv and encrypted payload
  const key = decrypted.subarray(0, 32);
  const iv = decrypted.subarray(16, 32);
  const dataCbc = decrypted.subarray(32); // 224 bytes

  if (dataCbc.length !== 224) {
    throw new Error(`Invalid AES payload length: ${dataCbc.length}`);
  }

  // 6. AES-CBC decrypt
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  decipher.setAutoPadding(false);

  const decryptedCbc = concatUint8Arrays([decipher.update(dataCbc), decipher.final()]);

  if (decryptedCbc.length !== 224) {
    throw new Error(`Decrypted AES payload length is not 224 bytes, received ${decryptedCbc.length}`);
  }

  // 7. SHA256 check
  const currentHash = crypto
    .createHash('sha256')
    .update(decryptedCbc.subarray(0, 208))
    .digest()
    .subarray(0, 16);

  const expectedHash = decryptedCbc.subarray(208, 224);
  // check if hash matches
  if (!currentHash.equals(expectedHash)) {
    throw new Error('SHA256 hash mismatch');
  }

  const parser = new TgExtensions.BinaryReader(Buffer.from(decryptedCbc.buffer, decryptedCbc.byteOffset, decryptedCbc.byteLength));
  const len = parser.readInt();
  if (len < 8 || len > 208) throw new Error(`Invalid TL data length: ${len}`);

  const constructorId = parser.readInt();

  if (constructorId !== Api.help.ConfigSimple.CONSTRUCTOR_ID) {
    throw new Error(`Invalid constructor ID: ${constructorId.toString(16)}`);
  }

  const payload = decryptedCbc.subarray(8, len);

  const configSimple = Api.help.ConfigSimple.fromReader(new TgExtensions.BinaryReader(Buffer.from(payload.buffer, payload.byteOffset, payload.byteLength)));

  return configSimple.rules.flatMap(rule => rule.ips.map(ip => {
    switch (ip.CONSTRUCTOR_ID) {
      case Api.IpPort.CONSTRUCTOR_ID:
      case Api.IpPortSecret.CONSTRUCTOR_ID:
        return {
          ip: bigint2ip(
            ip.ipv4 > 0
              ? BigInt(ip.ipv4)
              : (2n ** 32n) + BigInt(ip.ipv4),
            4
          ),
          port: ip.port
        };
      default:
        throw new TypeError(`Unknown IP type: 0x${ip.CONSTRUCTOR_ID.toString(16)}`);
    }
  }));
}

const pool = new Worktank({
  pool: {
    name: 'get-telegram-backup-ips',
    size: 1 // The number of workers to keep in the pool, if more workers are needed they will be spawned up to this limit
  },
  worker: {
    autoAbort: 10000,
    autoTerminate: 30000, // The interval of milliseconds at which to check if the pool can be automatically terminated, to free up resources, workers will be spawned up again if needed
    autoInstantiate: true,
    methods: {
      // eslint-disable-next-line object-shorthand -- workertank
      getTelegramBackupIPs: async function (__filename: string): Promise<{ timestamp: number, ipcidr: string[], ipcidr6: string[] }> {
        // TODO: createRequire is a temporary workaround for https://github.com/nodejs/node/issues/51956
        const { default: module } = await import('node:module');
        const __require = module.createRequire(__filename);

        const picocolors = __require('picocolors') as typeof import('picocolors');
        const { fetch } = __require('./fetch-retry') as typeof import('./fetch-retry');
        const DNS2 = __require('dns2') as typeof import('dns2');
        const { createReadlineInterfaceFromResponse } = __require('./fetch-text-by-line') as typeof import('./fetch-text-by-line');
        const { getTelegramBackupIPFromBase64 } = __require('./get-telegram-backup-ip') as typeof import('./get-telegram-backup-ip');
        const { fastIpVersion } = __require('foxts/fast-ip-version') as typeof import('foxts/fast-ip-version');

        const resp = await fetch('https://core.telegram.org/resources/cidr.txt');
        const lastModified = resp.headers.get('last-modified');
        const date = lastModified ? new Date(lastModified) : new Date();

        const ipcidr: string[] = [
          // Unused secret Telegram backup CIDR, announced by AS62041
          '95.161.64.0/20'
        ];
        const ipcidr6: string[] = [];

        for await (const cidr of createReadlineInterfaceFromResponse(resp, true)) {
          const v = fastIpVersion(cidr);
          if (v === 4) {
            ipcidr.push(cidr);
          } else if (v === 6) {
            ipcidr6.push(cidr);
          }
        }

        const backupIPs = new Set<string>();

        // https://github.com/tdlib/td/blob/master/td/telegram/ConfigManager.cpp

        // Backup IP Source 1 (DoH)
        await Promise.all([
          DNS2.DOHClient({ dns: 'https://8.8.4.4/dns-query?dns={query}' }),
          DNS2.DOHClient({ dns: 'https://1.0.0.1/dns-query?dns={query}' })
        ].flatMap(
          (client) => [
            'apv3.stel.com', // prod
            'tapv3.stel.com' // test
          ].map(async (domain) => {
            try {
              // tapv3.stel.com was for testing server
              const resp = await client(domain, 'TXT');
              const strings = resp.answers.map(i => i.data);

              const str = strings[0]!.length > strings[1]!.length
                ? strings[0]! + strings[1]!
                : strings[1]! + strings[0]!;

              const ips = getTelegramBackupIPFromBase64(str);
              ips.forEach(i => backupIPs.add(i.ip));

              console.log('[telegram backup ip]', picocolors.green('DoH TXT'), { domain, ips });
            } catch (e) {
              console.error('[telegram backup ip]', picocolors.red('DoH TXT error'), { domain }, e);
            }
          })
        ));

        // Backup IP Source 2: Firebase Realtime Database (test server not supported)
        try {
          const text = await (await fetch('https://reserve-5a846.firebaseio.com/ipconfigv3.json')).json();
          if (typeof text === 'string' && text.length === 344) {
            const ips = getTelegramBackupIPFromBase64(text);
            ips.forEach(i => backupIPs.add(i.ip));

            console.log('[telegram backup ip]', picocolors.green('Firebase Realtime DB'), { ips });
          }
        } catch (e) {
          console.error('[telegram backup ip]', picocolors.red('Firebase Realtime DB error'), e);
          // ignore all errors
        }

        // Backup IP Source 3: Firebase Value Store (test server not supported)
        try {
          const json = await (await fetch('https://firestore.googleapis.com/v1/projects/reserve-5a846/databases/(default)/documents/ipconfig/v3', {
            headers: {
              Accept: '*/*',
              Origin: undefined // Without this line, Google API will return "Bad request: Origin doesn't match Host for XD3.". Probably have something to do with sqlite cache store
            }
          })).json();

          // const json = await resp.json();
          if (
            json && typeof json === 'object'
            && 'fields' in json && typeof json.fields === 'object' && json.fields
            && 'data' in json.fields && typeof json.fields.data === 'object' && json.fields.data
            && 'stringValue' in json.fields.data && typeof json.fields.data.stringValue === 'string' && json.fields.data.stringValue.length === 344
          ) {
            const ips = getTelegramBackupIPFromBase64(json.fields.data.stringValue);
            ips.forEach(i => backupIPs.add(i.ip));

            console.log('[telegram backup ip]', picocolors.green('Firebase Value Store'), { ips });
          } else {
            console.error('[telegram backup ip]', picocolors.red('Firebase Value Store data format invalid'), { json });
          }
        } catch (e) {
          console.error('[telegram backup ip]', picocolors.red('Firebase Value Store error'), e);
        }

        // Backup IP Source 4: Google App Engine
        await Promise.all([
          'https://dns-telegram.appspot.com',
          'https://dns-telegram.appspot.com/test'
        ].map(async (url) => {
          try {
            const text = await (await fetch(url)).text();
            if (text.length === 344) {
              const ips = getTelegramBackupIPFromBase64(text);
              ips.forEach(i => backupIPs.add(i.ip));

              console.log('[telegram backup ip]', picocolors.green('Google App Engine'), { url, ips });
            }
          } catch (e) {
            console.error('[telegram backup ip]', picocolors.red('Google App Engine error'), { url }, e);
          }
        }));

        // tcdnb.azureedge.net no longer works

        console.log('[telegram backup ip]', `Found ${backupIPs.size} backup IPs:`, backupIPs);

        ipcidr.push(...Array.from(backupIPs).map(i => i + '/32'));

        return { timestamp: date.getTime(), ipcidr, ipcidr6 };
      }
    }
  }
});

export const getTelegramCIDRPromise = once(() => wait(0).then(() => pool.exec(
  'getTelegramBackupIPs',
  [__filename]
)).finally(() => pool.terminate()), false);
