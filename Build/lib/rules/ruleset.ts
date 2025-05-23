import type { Span } from '../../trace';
import { ClashClassicRuleSet } from '../writing-strategy/clash';
import { LegacyClashPremiumClassicRuleSet } from '../writing-strategy/legacy-clash-premium';
import { SingboxSource } from '../writing-strategy/singbox';
import { SurfboardRuleSet } from '../writing-strategy/surfboard';
import { SurgeRuleSet } from '../writing-strategy/surge';
import { FileOutput } from './base';

export class RulesetOutput extends FileOutput {
  constructor(span: Span, id: string, type: 'non_ip' | 'ip') {
    super(span, id);

    this.strategies = [
      new SurgeRuleSet(type),
      new ClashClassicRuleSet(type),
      new LegacyClashPremiumClassicRuleSet(type),
      new SurfboardRuleSet(type),
      new SingboxSource(type)
    ];
  }
}

export class SurgeOnlyRulesetOutput extends FileOutput {
  constructor(
    span: Span,
    id: string,
    type: 'non_ip' | 'ip' | (string & {}),
    overrideOutputDir?: string
  ) {
    super(span, id);

    this.strategies = [
      new SurgeRuleSet(type, overrideOutputDir)
    ];
  }
}

export class ClashOnlyRulesetOutput extends FileOutput {
  constructor(
    span: Span,
    id: string,
    type: 'non_ip' | 'ip'
  ) {
    super(span, id);

    this.strategies = [
      new ClashClassicRuleSet(type),
      new LegacyClashPremiumClassicRuleSet(type)
    ];
  }
}
