import type { Span } from '../../trace';
import { ClashClassicRuleSet } from '../writing-strategy/clash';
import { SingboxSource } from '../writing-strategy/singbox';
import { SurgeRuleSet } from '../writing-strategy/surge';
import { FileOutput } from './base';

export class RulesetOutput extends FileOutput {
  constructor(span: Span, id: string, protected type: 'non_ip' | 'ip' | (string & {})) {
    super(span, id);

    this.strategies = [
      new SurgeRuleSet(this.type),
      new ClashClassicRuleSet(this.type),
      new SingboxSource(this.type)
    ];
  }
}
