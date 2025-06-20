import { noop } from 'foxts/noop';
import { OUTPUT_LEAGCY_CLASH_PREMIUM_DIR } from '../../constants/dir';
import { ClashClassicRuleSet } from './clash';
import { MARKER_DOMAIN } from '../../constants/description';

export class LegacyClashPremiumClassicRuleSet extends ClashClassicRuleSet {
  public override readonly name = 'legacy clash premium classic ruleset';

  readonly fileExtension = 'txt';

  protected result: string[] = [`DOMAIN,${MARKER_DOMAIN}`];

  constructor(public readonly type: 'ip' | 'non_ip' /* | (string & {}) */, public readonly outputDir = OUTPUT_LEAGCY_CLASH_PREMIUM_DIR) {
    super(type, outputDir);
  }

  override writeDomainWildcard = noop;
  override writeIpAsns = noop;
}
