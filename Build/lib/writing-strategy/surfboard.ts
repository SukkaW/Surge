import { noop } from 'foxts/noop';
import { SurgeRuleSet } from './surge';
import { OUTPUT_SURFBOARD_DIR } from '../../constants/dir';
import { appendSetElementsToArray } from 'foxts/append-set-elements-to-array';
import { MARKER_DOMAIN } from '../../constants/description';

export class SurfboardRuleSet extends SurgeRuleSet {
  public override readonly name: string = 'surfboard for android ruleset';

  protected result: string[] = [`DOMAIN,${MARKER_DOMAIN}`];
  constructor(public readonly type: 'ip' | 'non_ip' /* | (string & {}) */, public readonly outputDir = OUTPUT_SURFBOARD_DIR) {
    super(type, outputDir);
  }

  override writeDomainWildcard = noop;
  override writeUserAgents = noop;
  override writeUrlRegexes = noop;
  override writeIpAsns = noop;

  override writeSourcePorts(port: Set<string>): void {
    // https://getsurfboard.com/docs/profile-format/rule/misc
    appendSetElementsToArray(this.result, port, i => `IN-PORT,${i}`);
  }

  override writeOtherRules = noop;
}
