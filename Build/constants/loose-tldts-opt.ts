import type * as tldts from 'tldts';

export const looseTldtsOpt: Parameters<typeof tldts.getSubdomain>[1] = {
  allowPrivateDomains: false,
  extractHostname: false,
  validateHostname: false,
  detectIp: false,
  mixedInputs: false
};

export const loosTldOptWithPrivateDomains: Parameters<typeof tldts.getSubdomain>[1] = {
  ...looseTldtsOpt,
  allowPrivateDomains: true
};

export const normalizeTldtsOpt: Parameters<typeof tldts.getSubdomain>[1] = {
  allowPrivateDomains: true,
  detectIp: true
};
