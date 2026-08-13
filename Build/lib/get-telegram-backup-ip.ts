// https://reserve-5a846.firebaseio.com/ipconfigv3.json
// apv3.stel.com tapv3.stel.com
import { Buffer } from 'node:buffer';
import crypto from 'node:crypto';
import { BinaryReader as TgBinaryReader } from 'telegram/extensions/BinaryReader';
import { Api as TgApi } from 'telegram/tl/api';
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

export interface TelegramBackupEndpoint {
  dcId: number,
  ip: string,
  port: number,
  secret?: Uint8Array
}

// Telegram's original, pre-AccessPointRule backup schema:
// help.configSimple#d997c3c5 date:int expires:int dc_id:int
//   ip_port_list:Vector<ipPort> = help.ConfigSimple;
// It applies one DC ID to a bare vector of (ipv4, port) pairs. GramJS only
// generates TgApi.help.ConfigSimple for the current #5a592a6c rule-based schema,
// so the removed legacy constructor has no TgApi symbol to reference.
const LEGACY_CONFIG_SIMPLE_CONSTRUCTOR_ID = 0xD9_97_C3_C5;

// The legacy vector contains bare ipPort values, so TgBinaryReader#tgReadVector
// cannot decode it as a vector of boxed TL objects. GramJS does not export the
// core vector constructor ID, either, so validate it explicitly before reading.
const TL_VECTOR_CONSTRUCTOR_ID = 0x1C_B5_C4_15;

function ipv4ToString(ipv4: number) {
  return bigint2ip(
    ipv4 > 0
      ? BigInt(ipv4)
      : (2n ** 32n) + BigInt(ipv4),
    4
  );
}

function validateBackupEndpoint(endpoint: TelegramBackupEndpoint) {
  if (endpoint.dcId < 1 || endpoint.dcId > 5 || endpoint.port < 1 || endpoint.port > 65535) {
    throw new TypeError(`Invalid Telegram backup endpoint: DC ${endpoint.dcId}, port ${endpoint.port}`);
  }
  return endpoint;
}

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
    throw new TypeError('Decoded buffer length is not 256 bytes, received ' + decoded.length);
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

  const parser = new TgBinaryReader(Buffer.from(decryptedCbc.buffer, decryptedCbc.byteOffset, decryptedCbc.byteLength));
  const len = parser.readInt();
  if (len < 4 || len > 204 || len % 4 !== 0) throw new Error(`Invalid TL data length: ${len}`);

  const constructorId = parser.readInt() >>> 0;

  const endpoints: TelegramBackupEndpoint[] = [];
  let date: number;
  let expires: number;

  if (constructorId === TgApi.help.ConfigSimple.CONSTRUCTOR_ID) {
    const payload = decryptedCbc.subarray(8, 4 + len);
    const configSimple = TgApi.help.ConfigSimple.fromReader(new TgBinaryReader(Buffer.from(payload.buffer, payload.byteOffset, payload.byteLength)));

    date = configSimple.date;
    expires = configSimple.expires;
    for (let ruleIndex = 0, ruleCount = configSimple.rules.length; ruleIndex < ruleCount; ruleIndex++) {
      const rule = configSimple.rules[ruleIndex];
      for (let ipIndex = 0, ipCount = rule.ips.length; ipIndex < ipCount; ipIndex++) {
        const ip = rule.ips[ipIndex];
        endpoints.push(validateBackupEndpoint({
          dcId: rule.dcId,
          ip: ipv4ToString(ip.ipv4),
          port: ip.port,
          ...((ip instanceof TgApi.IpPortSecret) && { secret: ip.secret })
        }));
      }
    }
  } else if (constructorId === LEGACY_CONFIG_SIMPLE_CONSTRUCTOR_ID) {
    date = parser.readInt();
    expires = parser.readInt();
    const dcId = parser.readInt();
    const vectorConstructorId = parser.readInt() >>> 0;
    const count = parser.readInt();

    if (vectorConstructorId !== TL_VECTOR_CONSTRUCTOR_ID || count < 1 || count > 1024) {
      throw new Error('Invalid legacy Telegram backup endpoint vector');
    }

    for (let i = 0; i < count; i++) {
      endpoints.push(validateBackupEndpoint({
        dcId,
        ip: ipv4ToString(parser.readInt()),
        port: parser.readInt()
      }));
    }
  } else {
    throw new Error(`Invalid constructor ID: 0x${constructorId.toString(16)}`);
  }

  const now = Math.floor(Date.now() / 1000);
  if (date >= now + 20 * 60 || expires <= now - 20 * 60) {
    throw new Error(`Telegram backup configuration is outside its validity interval (${date}...${expires}, now ${now})`);
  }

  return endpoints;
}
