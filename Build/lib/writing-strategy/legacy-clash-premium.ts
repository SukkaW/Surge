import { noop } from 'foxts/noop';
import { OUTPUT_LEAGCY_CLASH_PREMIUM } from '../../constants/dir';
import { ClashClassicRuleSet } from './clash';

export class LegacyClashPremiumRuleSet extends ClashClassicRuleSet {
  public override readonly name = 'legacy clash premium ruleset';

  readonly fileExtension = 'txt';

  protected result: string[] = ['DOMAIN,this_ruleset_is_made_by_sukkaw.ruleset.skk.moe'];

  constructor(public readonly type: 'ip' | 'non_ip' /* | (string & {}) */, public readonly outputDir = OUTPUT_LEAGCY_CLASH_PREMIUM) {
    super(type, outputDir);
  }

  override writeDomainWildcards = noop;
  override writeIpAsns = noop;
}
