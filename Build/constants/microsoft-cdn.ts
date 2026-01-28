export const PROBE_DOMAINS = ['.microsoft.com', '.windows.net', '.windows.com', '.windowsupdate.com', '.windowssearch.com', '.office.net'];

export const RULES = [
  // Microsoft OCSP (HTTP Only)
  String.raw`URL-REGEX,^http://www\.microsoft\.com/pki/`,
  String.raw`URL-REGEX,^http://www\.microsoft\.com/pkiops/`
];

export const DOMAINS = [
  'res.cdn.office.net',
  'res-1.cdn.office.net',
  'res-2.cdn.office.net',
  'res-h3.public.cdn.office.net',
  'statics.teams.cdn.office.net'
];

export const DOMAIN_SUFFIXES = [];

export const BLACKLIST = [
  'www.microsoft.com',
  'windowsupdate.com'
];
