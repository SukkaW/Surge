// https://reserve-5a846.firebaseio.com/ipconfigv3.json
// apv3.stel.com tapv3.stel.com
import { Buffer } from 'node:buffer';
import crypto from 'node:crypto';
import { Api, extensions as TgExtensions } from 'telegram';
import { bigint2ip } from 'fast-cidr-tools';

import { base64ToUint8Array, concatUint8Arrays } from 'foxts/uint8array-utils';

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
