import type { Span } from '../../trace';
import type { BaseWriteStrategy } from '../writing-strategy/base';
import { ClashClassicRuleSet, ClashIPSet } from '../writing-strategy/clash';
import { SingboxSource } from '../writing-strategy/singbox';
import { SurgeRuleSet } from '../writing-strategy/surge';
import { FileOutput } from './base';

export class IPListOutput extends FileOutput {
  strategies: BaseWriteStrategy[];

  constructor(span: Span, id: string, private readonly clashUseRule = true) {
    super(span, id);

    this.strategies = [
      new SurgeRuleSet('ip'),
      this.clashUseRule ? new ClashClassicRuleSet('ip') : new ClashIPSet(),
      new SingboxSource('ip')
    ];
  }
}
