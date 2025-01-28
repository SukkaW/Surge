import type { BaseWriteStrategy } from '../writing-strategy/base';
import { ClashDomainSet } from '../writing-strategy/clash';
import { SingboxSource } from '../writing-strategy/singbox';
import { SurgeDomainSet } from '../writing-strategy/surge';
import { FileOutput } from './base';

export class DomainsetOutput extends FileOutput {
  protected type = 'domainset' as const;

  strategies: Array<false | BaseWriteStrategy> = [
    new SurgeDomainSet(),
    new ClashDomainSet(),
    new SingboxSource(this.type)
  ];
}
