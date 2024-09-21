import type { Span } from '../../trace';
import { appendArrayFromSet } from '../misc';
import type { SingboxSourceFormat } from '../singbox';
import { RuleOutput } from './base';

export class IPListOutput extends RuleOutput {
  protected type = 'ip' as const;

  constructor(span: Span, id: string, private readonly clashUseRule = true) {
    super(span, id);
  }

  private $merged: string[] | null = null;
  get merged() {
    if (!this.$merged) {
      this.$merged = appendArrayFromSet(appendArrayFromSet([], this.ipcidr), this.ipcidr6);
    }
    return this.$merged;
  }

  private $surge: string[] | null = null;

  surge(): string[] {
    if (!this.$surge) {
      const results: string[] = ['DOMAIN,this_ruleset_is_made_by_sukkaw.ruleset.skk.moe'];

      appendArrayFromSet(results, this.ipcidr, i => `IP-CIDR,${i}`);
      appendArrayFromSet(results, this.ipcidr6, i => `IP-CIDR6,${i}`);

      this.$surge = results;
    }
    return this.$surge;
  }

  clash(): string[] {
    if (this.clashUseRule) {
      return this.surge();
    }

    return this.merged;
  }

  singbox(): string[] {
    const singbox: SingboxSourceFormat = {
      version: 2,
      rules: [{
        domain: ['this_ruleset_is_made_by_sukkaw.ruleset.skk.moe'],
        ip_cidr: this.merged
      }]
    };
    return RuleOutput.jsonToLines(singbox);
  }
}
