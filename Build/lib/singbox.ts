const unsupported = Symbol('unsupported');

// https://sing-box.sagernet.org/configuration/rule-set/source-format/
export const PROCESSOR: Record<string, ((raw: string, type: string, value: string) => [key: keyof SingboxHeadlessRule, value: Required<SingboxHeadlessRule>[keyof SingboxHeadlessRule][number]] | null) | typeof unsupported> = {
  'IP-ASN': unsupported,
  'URL-REGEX': unsupported,
  'USER-AGENT': unsupported
};

interface SingboxHeadlessRule {
  domain?: string[],
  domain_suffix?: string[],
  domain_keyword?: string[],
  domain_regex?: string[],
  source_ip_cidr?: string[],
  ip_cidr?: string[],
  source_port?: number[],
  source_port_range?: string[],
  port?: number[],
  port_range?: string[],
  process_name?: string[],
  process_path?: string[]
}

export interface SingboxSourceFormat {
  version: 2 | number & {},
  rules: SingboxHeadlessRule[]
}
