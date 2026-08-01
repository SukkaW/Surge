import { BaseWriteStrategy } from './base';
import { appendArrayInPlace } from 'foxts/append-array-in-place';
import { noop } from 'foxts/noop';
import { withIdentityContent } from '../misc';
import { OUTPUT_SINGBOX_DIR } from '../../constants/dir';
import { MARKER_DOMAIN } from '../../constants/description';
import { fastStringArrayJoin } from 'foxts/fast-string-array-join';

interface SingboxHeadlessRule {
  domain: string[],
  domain_suffix: string[],
  domain_keyword?: string[],
  domain_regex?: string[],
  source_ip_cidr?: string[],
  ip_cidr?: string[],
  source_port?: number[],
  source_port_range?: string[],
  port?: number[],
  port_range?: string[],
  process_name?: string[],
  process_path?: string[],
  network?: string[]
}

export interface SingboxSourceFormat {
  version: 2 | number & {},
  rules: SingboxHeadlessRule[]
}

/**
 * json-stringify-pretty-compact spends most of its time re-serializing the whole
 * subtree at every nesting level just to decide whether it fits on one line -- for
 * a 145k-domain ruleset that is several full passes over a multi-megabyte string,
 * plus a final split('\n').
 *
 * Our document shape is fixed (`{version, rules: [rule]}`, rule values are flat
 * arrays of string/number), so we emit the lines directly and only probe as many
 * items as it takes to know a line cannot fit.
 */
const SINGBOX_MAX_LENGTH = 120;
/** rule values live at indent 6 */
const RULE_VALUE_INDENT = 6;

type SingboxRuleValue = string[] | number[];

/** prettified JSON of `arr` when it fits `budget`, else null -- bails out early */
function inlineIfFits(arr: SingboxRuleValue, budget: number): string | null {
  if (arr.length === 0) {
    return '[]';
  }

  let len = 2; // [ and ]
  if (len > budget) {
    return null;
  }

  const first = JSON.stringify(arr[0]);
  len += first.length;
  if (len > budget) {
    return null;
  }
  const parts: string[] = [
    first
  ];
  for (let i = 1, l = arr.length; i < l; i++) {
    const item = JSON.stringify(arr[i]);
    len += item.length + 2; // ', ' separator
    if (len > budget) {
      return null;
    }
    parts.push(item);
  }
  return '[' + fastStringArrayJoin(parts, ', ') + ']';
}

export function singboxSourceToLines(rule: SingboxHeadlessRule): string[] {
  const keys = Object.keys(rule) as Array<keyof SingboxHeadlessRule>;
  const lines: string[] = ['{', '  "version": 2,', '  "rules": [', '    {'];

  for (let i = 0, l = keys.length; i < l; i++) {
    const key = keys[i];
    const arr = rule[key];
    if (!Array.isArray(arr)) {
      throw new TypeError('singbox rule source value is not an array');
    }

    const keyPart = JSON.stringify(key) + ': ';
    const isLast = i === l - 1;
    const trailing = isLast ? '' : ',';
    // the library reserves the key prefix plus, unless last, the trailing comma
    const budget = SINGBOX_MAX_LENGTH - RULE_VALUE_INDENT - (keyPart.length + (isLast ? 0 : 1));

    const inlined = inlineIfFits(arr, budget);
    if (inlined !== null) {
      lines.push('      ' + keyPart + inlined + trailing);
      continue;
    }

    lines.push('      ' + keyPart + '[');
    for (let j = 0, l2 = arr.length; j < l2; j++) {
      lines.push('        ' + JSON.stringify(arr[j]) + (j === l2 - 1 ? '' : ','));
    }
    lines.push('      ]' + trailing);
  }

  lines.push('    }', '  ]', '}');
  return lines;
}

export class SingboxSource extends BaseWriteStrategy {
  public readonly name = 'singbox';

  readonly fileExtension = 'json';

  // JSON output has no metadata comment at all, nothing to preserve
  protected override readonly skipCompareOnCI = true;

  private readonly singbox: SingboxHeadlessRule = {
    domain: [MARKER_DOMAIN],
    domain_suffix: [MARKER_DOMAIN]
  };

  protected get result() {
    return singboxSourceToLines(this.singbox);
  }

  constructor(
    /** Since sing-box only have one format that does not reflect type, we need to specify it */
    public type: 'domainset' | 'non_ip' | 'ip' /* | (string & {}) */,
    public readonly outputDir = OUTPUT_SINGBOX_DIR
  ) {
    super(outputDir);
  }

  withPadding = withIdentityContent;

  writeDomain(domain: string): void {
    this.singbox.domain.push(domain);
  }

  writeDomainSuffix(domain: string): void {
    this.singbox.domain_suffix.push(domain);
  }

  writeDomainKeywords(keyword: Set<string>): void {
    appendArrayInPlace(
      this.singbox.domain_keyword ??= [],
      Array.from(keyword)
    );
  }

  writeDomainWildcard = noop;
  writeUserAgents = noop;
  writeProcessNames = noop;
  writeProcessPaths = noop;
  writeUrlRegexes = noop;

  writeIpCidrs(ipCidr: string[]): void {
    appendArrayInPlace(
      this.singbox.ip_cidr ??= [],
      ipCidr
    );
  }

  writeIpCidr6s(ipCidr6: string[]): void {
    appendArrayInPlace(
      this.singbox.ip_cidr ??= [],
      ipCidr6
    );
  }

  writeGeoip = noop;
  writeIpAsns = noop;
  writeSourceIpCidrs = noop;
  writeSourcePorts = noop;
  writeDestinationPorts = noop;
  writeProtocols = noop;
  writeOtherRules = noop;
}
