import type { Span } from '../../trace';
import type { BaseWriteStrategy } from '../writing-strategy/base';
import { ClashClassicRuleSet, ClashIPSet } from '../writing-strategy/clash';
import { SingboxSource } from '../writing-strategy/singbox';
import { SurgeRuleSet } from '../writing-strategy/surge';
import { FileOutput } from './base';

export class IPListOutput extends FileOutput {
  protected type = 'ip' as const;
  strategies: Array<false | BaseWriteStrategy>;

  constructor(span: Span, id: string, private readonly clashUseRule = true) {
    super(span, id);

    this.strategies = [
      new SurgeRuleSet(this.type),
      this.clashUseRule ? new ClashClassicRuleSet(this.type) : new ClashIPSet(),
      new SingboxSource(this.type)
    ];
  }
}
