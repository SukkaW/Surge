import type { Span } from '../../trace';
import { appendArrayInPlace } from '../append-array-in-place';
import { appendSetElementsToArray } from 'foxts/append-set-elements-to-array';
import type { SingboxSourceFormat } from '../singbox';
import { RuleOutput } from './base';

import { merge } from 'fast-cidr-tools';

type Preprocessed = string[];

export class IPListOutput extends RuleOutput<Preprocessed> {
  protected type = 'ip' as const;

  constructor(span: Span, id: string, private readonly clashUseRule = true) {
    super(span, id);
  }

  mitmSgmodule = undefined;

  protected preprocess() {
    const results: string[] = [];
    appendArrayInPlace(
      results,
      merge(
        appendArrayInPlace(Array.from(this.ipcidrNoResolve), Array.from(this.ipcidr)),
        true
      )
    );
    appendSetElementsToArray(results, this.ipcidr6NoResolve);
    appendSetElementsToArray(results, this.ipcidr6);

    return results;
  }

  private $surge: string[] | null = null;

  surge(): string[] {
    if (!this.$surge) {
      const results: string[] = ['DOMAIN,this_ruleset_is_made_by_sukkaw.ruleset.skk.moe'];

      appendArrayInPlace(
        results,
        merge(Array.from(this.ipcidrNoResolve)).map(i => `IP-CIDR,${i},no-resolve`, true)
      );
      appendSetElementsToArray(results, this.ipcidr6NoResolve, i => `IP-CIDR6,${i},no-resolve`);
      appendArrayInPlace(
        results,
        merge(Array.from(this.ipcidr)).map(i => `IP-CIDR,${i}`, true)
      );
      appendSetElementsToArray(results, this.ipcidr6, i => `IP-CIDR6,${i}`);

      this.$surge = results;
    }
    return this.$surge;
  }

  clash(): string[] {
    if (this.clashUseRule) {
      return this.surge();
    }

    return this.$preprocessed;
  }

  singbox(): string[] {
    const singbox: SingboxSourceFormat = {
      version: 2,
      rules: [{
        domain: ['this_ruleset_is_made_by_sukkaw.ruleset.skk.moe'],
        ip_cidr: this.$preprocessed
      }]
    };
    return RuleOutput.jsonToLines(singbox);
  }
}
