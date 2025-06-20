import type * as tldts from 'tldts';

export const looseTldtsOpt: NonNullable<Parameters<typeof tldts.getSubdomain>[1]> = {
  allowPrivateDomains: false,
  extractHostname: false,
  mixedInputs: false,
  validateHostname: false,
  detectIp: false
};

export const loosTldOptWithPrivateDomains: NonNullable<Parameters<typeof tldts.getSubdomain>[1]> = {
  ...looseTldtsOpt,
  allowPrivateDomains: true
};

export const normalizeTldtsOpt: NonNullable<Parameters<typeof tldts.getSubdomain>[1]> = {
  allowPrivateDomains: true,
  // in normalizeDomain, we only care if it contains IP, we don't care if we need to extract it
  // by setting detectIp to false and manually check ip outside tldts.parse, we can skip the tldts
  // inner "extractHostname" call
  detectIp: false
};
