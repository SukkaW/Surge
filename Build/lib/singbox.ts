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
