import { Buffer } from 'node:buffer';
import { stableHash } from 'stable-hash';

import type { Api as TgApi } from 'telegram';

import type { TelegramBackupEndpoint } from './get-telegram-backup-ip';
import { setBit, getBit } from 'foxts/bitwise';
import { bigint2ip, ip2bigint } from 'fast-cidr-tools';
import { isProbablyIpv6 } from 'foxts/is-probably-ip';

export const DC_OPTION_FLAG_IPV6 = 1 << 0;
export const DC_OPTION_FLAG_MEDIA_ONLY = 1 << 1;
export const DC_OPTION_FLAG_TCPO_ONLY = 1 << 2;
export const DC_OPTION_FLAG_CDN = 1 << 3;
export const DC_OPTION_FLAG_STATIC = 1 << 4;
export const DC_OPTION_FLAG_THIS_PORT_ONLY = 1 << 5;
export const DC_OPTION_FLAG_SECRET = 1 << 10;

export interface MTProtoDCConfigOption {
  id: number,
  ip: string,
  port: number,
  flags: number,
  secret?: string
}

export interface MTProtoDCConfig {
  version: 1,
  date: number,
  expires: number,
  this_dc: number,
  options: MTProtoDCConfigOption[]
}

export interface MTProtoEndpoint {
  dcId: number,
  ip: string,
  port: number,
  secret?: Uint8Array
}

export const TELEGRAM_BOOTSTRAP_ENDPOINTS: readonly MTProtoEndpoint[] = [
  { dcId: 1, ip: '149.154.175.50', port: 443 },
  { dcId: 1, ip: '2001:b28:f23d:f001::a', port: 443 },
  { dcId: 2, ip: '149.154.167.50', port: 443 },
  { dcId: 2, ip: '149.154.167.51', port: 443 },
  { dcId: 2, ip: '95.161.76.100', port: 443 },
  { dcId: 2, ip: '2001:67c:4e8:f002::a', port: 443 },
  { dcId: 3, ip: '149.154.175.100', port: 443 },
  { dcId: 3, ip: '2001:b28:f23d:f003::a', port: 443 },
  { dcId: 4, ip: '149.154.167.91', port: 443 },
  { dcId: 4, ip: '2001:67c:4e8:f004::a', port: 443 },
  { dcId: 5, ip: '149.154.171.5', port: 443 },
  { dcId: 5, ip: '2001:b28:f23f:f005::a', port: 443 }
];

type DcOptionWithFlags = TgApi.DcOption & { flags?: number };

/**
 * help.getConfig returns IPv6 addresses fully expanded (leading zeros in every
 * hextet, no "::"), while TELEGRAM_BOOTSTRAP_ENDPOINTS is written in the
 * canonical RFC 5952 form. Without canonicalizing, mergeEndpoint's string
 * compare never matches the two spellings of the same address, so every IPv6
 * bootstrap gets appended as a duplicate option and the live option never
 * receives DC_OPTION_FLAG_STATIC. IPv4 has a single spelling and is passed
 * through untouched.
 */
function canonicalizeIp(ip: string) {
  if (!isProbablyIpv6(ip)) return ip;
  return bigint2ip(ip2bigint(ip, 6), 6, true);
}

function deriveDcOptionFlags(option: TgApi.DcOption) {
  let flags = 0;
  if (option.ipv6) flags = setBit(flags, DC_OPTION_FLAG_IPV6);
  if (option.mediaOnly) flags = setBit(flags, DC_OPTION_FLAG_MEDIA_ONLY);
  if (option.tcpoOnly) flags = setBit(flags, DC_OPTION_FLAG_TCPO_ONLY);
  if (option.cdn) flags = setBit(flags, DC_OPTION_FLAG_CDN);
  if (option.static) flags = setBit(flags, DC_OPTION_FLAG_STATIC);
  if (option.thisPortOnly) flags = setBit(flags, DC_OPTION_FLAG_THIS_PORT_ONLY);
  if (option.secret) flags = setBit(flags, DC_OPTION_FLAG_SECRET);
  return flags;
}

export function normalizeTelegramConfig(config: TgApi.Config): MTProtoDCConfig {
  return {
    version: 1,
    date: config.date,
    expires: config.expires,
    this_dc: config.thisDc,
    options: config.dcOptions.map((rawOption) => {
      const option = rawOption as DcOptionWithFlags;
      const normalized: MTProtoDCConfigOption = {
        id: option.id,
        ip: canonicalizeIp(option.ipAddress),
        port: option.port,
        flags: Number.isSafeInteger(option.flags) ? option.flags! : deriveDcOptionFlags(option)
      };

      if (option.secret) {
        normalized.secret = Buffer.from(option.secret).toString('base64');
      }

      return normalized;
    })
  };
}

function fallbackFlags(ip: string, hasSecret: boolean) {
  let flags = DC_OPTION_FLAG_STATIC;
  if (ip.includes(':')) flags = setBit(flags, DC_OPTION_FLAG_IPV6);
  if (hasSecret) flags = setBit(flags, DC_OPTION_FLAG_SECRET);
  return flags;
}

function mergeEndpoint(config: MTProtoDCConfig, endpoint: MTProtoEndpoint) {
  const secret = endpoint.secret ? Buffer.from(endpoint.secret).toString('base64') : undefined;
  const ip = canonicalizeIp(endpoint.ip);
  const functionalFlags = setBit(setBit(DC_OPTION_FLAG_MEDIA_ONLY, DC_OPTION_FLAG_TCPO_ONLY), DC_OPTION_FLAG_CDN);
  let matched = false;

  for (let i = 0, len = config.options.length; i < len; i++) {
    const option = config.options[i];
    if (
      option.id !== endpoint.dcId
      || option.ip !== ip
      || option.port !== endpoint.port
      || getBit(option.flags, functionalFlags)
      || option.secret !== secret
    ) {
      continue;
    }

    option.flags = setBit(option.flags, fallbackFlags(ip, secret !== undefined));
    matched = true;
  }

  if (!matched) {
    config.options.push({
      id: endpoint.dcId,
      ip,
      port: endpoint.port,
      flags: fallbackFlags(ip, secret !== undefined),
      ...(!(secret === undefined) && { secret })
    });
  }

  return !matched;
}

function deduplicateOptions(config: MTProtoDCConfig) {
  const previousCount = config.options.length;
  const seen = new Set<string>();

  config.options = config.options.filter((option) => {
    const key = stableHash(option);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return previousCount - config.options.length;
}

export function mergeFallbackEndpoints(
  config: MTProtoDCConfig,
  backupEndpoints: readonly TelegramBackupEndpoint[]
) {
  // mergeEndpoint compares IP strings, so both sides must already be canonical.
  // normalizeTelegramConfig canonicalizes the help.getConfig response, but the
  // merge cannot assume its input came from there.
  for (let i = 0, len = config.options.length; i < len; i++) {
    const option = config.options[i];
    option.ip = canonicalizeIp(option.ip);
  }

  let backupAdded = 0;
  for (let i = 0, len = backupEndpoints.length; i < len; i++) {
    const endpoint = backupEndpoints[i];
    if (mergeEndpoint(config, endpoint)) backupAdded++;
  }

  let bootstrapAdded = 0;
  for (let i = 0, len = TELEGRAM_BOOTSTRAP_ENDPOINTS.length; i < len; i++) {
    const endpoint = TELEGRAM_BOOTSTRAP_ENDPOINTS[i];
    if (mergeEndpoint(config, endpoint)) bootstrapAdded++;
  }

  return {
    backupAdded,
    bootstrapAdded,
    duplicatesRemoved: deduplicateOptions(config)
  };
}
