import { noop } from 'foxts/noop';
import { SurgeRuleSet } from './surge';
import { OUTPUT_SURFBOARD_DIR } from '../../constants/dir';
import { appendSetElementsToArray } from 'foxts/append-set-elements-to-array';

export class SurfboardRuleSet extends SurgeRuleSet {
  public override readonly name: string = 'surfboard for android ruleset';

  protected result: string[] = ['DOMAIN,this_ruleset_is_made_by_sukkaw.ruleset.skk.moe'];
  constructor(public readonly type: 'ip' | 'non_ip' /* | (string & {}) */, public readonly outputDir = OUTPUT_SURFBOARD_DIR) {
    super(type, outputDir);
  }

  override writeDomainWildcards = noop;
  override writeUserAgents = noop;
  override writeUrlRegexes = noop;
  override writeIpAsns = noop;

  override writeSourcePorts(port: Set<string>): void {
    // https://getsurfboard.com/docs/profile-format/rule/misc
    appendSetElementsToArray(this.result, port, i => `IN-PORT,${i}`);
  }

  override writeOtherRules = noop;
}
