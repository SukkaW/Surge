import { describe, it } from 'mocha';
import { expect } from 'earl';

import {
  DC_OPTION_FLAG_IPV6,
  DC_OPTION_FLAG_STATIC,
  mergeFallbackEndpoints,
  TELEGRAM_BOOTSTRAP_ENDPOINTS
} from './mtproto-dc-config';
import type { MTProtoDCConfig } from './mtproto-dc-config';
import { setBit } from 'foxts/bitwise';

describe('MTProto DC config', () => {
  it('merges static fallbacks and removes exact duplicates', () => {
    const config: MTProtoDCConfig = {
      version: 1,
      date: 1,
      expires: 2,
      this_dc: 5,
      options: [
        { id: 5, ip: '91.108.56.191', port: 443, flags: 0 },
        { id: 5, ip: '91.108.56.191', port: 443, flags: DC_OPTION_FLAG_STATIC }
      ]
    };

    const result = mergeFallbackEndpoints(config, [
      { dcId: 5, ip: '91.108.56.201', port: 443 },
      { dcId: 5, ip: '91.108.56.191', port: 443 }
    ]);

    expect(result.backupAdded).toEqual(1);
    expect(result.duplicatesRemoved).toEqual(1);
    expect(config.options.filter(option => option.ip === '91.108.56.191').length).toEqual(1);
    expect(config.options.some(option => (
      option.id === 5
      && option.ip === '91.108.56.201'
      && option.flags === DC_OPTION_FLAG_STATIC
    ))).toEqual(true);
    expect(config.options.some(option => (
      option.id === 5
      && option.ip === '2001:b28:f23f:f005::a'
      && option.flags === (setBit(DC_OPTION_FLAG_STATIC, DC_OPTION_FLAG_IPV6))
    ))).toEqual(true);
  });

  it('matches expanded and compressed spellings of the same IPv6 endpoint', () => {
    const config: MTProtoDCConfig = {
      version: 1,
      date: 1,
      expires: 2,
      this_dc: 1,
      options: [
        // help.getConfig returns IPv6 fully expanded, the bootstrap list does not.
        { id: 1, ip: '2001:0b28:f23d:f001:0000:0000:0000:000a', port: 443, flags: DC_OPTION_FLAG_IPV6 }
      ]
    };

    const result = mergeFallbackEndpoints(config, []);
    const ipv6Options = config.options.filter(option => option.ip.includes(':'));

    // The DC1 bootstrap merges into the existing option instead of being appended.
    expect(ipv6Options.filter(option => option.id === 1).length).toEqual(1);
    expect(ipv6Options.some(option => (
      option.id === 1
      && option.ip === '2001:b28:f23d:f001::a'
      && option.flags === setBit(DC_OPTION_FLAG_IPV6, DC_OPTION_FLAG_STATIC)
    ))).toEqual(true);
    // DC2-5 IPv6 bootstraps are still absent from the config, so they get added.
    expect(result.bootstrapAdded).toEqual(TELEGRAM_BOOTSTRAP_ENDPOINTS.length - 1);
  });

  it('keeps functional variants separate and preserves backup secrets', () => {
    const config: MTProtoDCConfig = {
      version: 1,
      date: 1,
      expires: 2,
      this_dc: 2,
      options: [
        { id: 2, ip: '149.154.167.50', port: 443, flags: 1 << 3 }
      ]
    };

    mergeFallbackEndpoints(config, [{
      dcId: 2,
      ip: '149.154.167.50',
      port: 443,
      secret: Uint8Array.from([1, 2, 3])
    }]);

    expect(config.options.some(option => (
      option.ip === '149.154.167.50'
      && option.secret === 'AQID'
      && option.flags === (setBit(1 << 10, DC_OPTION_FLAG_STATIC))
    ))).toEqual(true);
  });
});
