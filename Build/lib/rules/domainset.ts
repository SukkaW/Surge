import type { Span } from '../../trace';
import { AdGuardHome } from '../writing-strategy/adguardhome';
import type { BaseWriteStrategy } from '../writing-strategy/base';
import { ClashDomainSet } from '../writing-strategy/clash';
import { SingboxSource } from '../writing-strategy/singbox';
import { SurgeDomainSet } from '../writing-strategy/surge';
import { FileOutput } from './base';

export class DomainsetOutput extends FileOutput {
  strategies: Array<false | BaseWriteStrategy> = [
    new SurgeDomainSet(),
    new ClashDomainSet(),
    new SingboxSource('domainset')
  ];
}

export class AdGuardHomeOutput extends FileOutput {
  strategies: Array<false | BaseWriteStrategy>;

  constructor(
    span: Span,
    id: string,
    outputDir: string
  ) {
    super(span, id);

    this.strategies = [
      new AdGuardHome(outputDir)
    ];
  }
}
