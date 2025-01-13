// @ts-check
import type { Span } from './trace';
import { task } from './trace';

import { ALL, NORTH_AMERICA, EU, HK, TW, JP, KR, BILI_INTL } from '../Source/stream';
import { SHARED_DESCRIPTION } from './constants/description';
import { RulesetOutput } from './lib/create-file';

export function createRulesetForStreamService(span: Span,
  fileId: string, title: string,
  streamServices: Array<import('../Source/stream').StreamService>) {
  return span.traceChildAsync(fileId, async (childSpan) => Promise.all([
    // Domains
    new RulesetOutput(childSpan, fileId, 'non_ip')
      .withTitle(`Sukka's Ruleset - Stream Services: ${title}`)
      .withDescription([
        ...SHARED_DESCRIPTION,
        '',
        ...streamServices.map((i) => `- ${i.name}`)
      ])
      .addFromRuleset(streamServices.flatMap((i) => i.rules))
      .write(),
    // IP
    new RulesetOutput(childSpan, fileId, 'ip')
      .withTitle(`Sukka's Ruleset - Stream Services IPs: ${title}`)
      .withDescription([
        ...SHARED_DESCRIPTION,
        '',
        ...streamServices.map((i) => `- ${i.name}`)
      ])
      .bulkAddCIDR4NoResolve(streamServices.flatMap(i => i.ip?.v4 ?? []))
      .bulkAddCIDR6NoResolve(streamServices.flatMap(i => i.ip?.v6 ?? []))
      .write()
  ]));
}

export const buildStreamService = task(require.main === module, __filename)(async (span) => Promise.all([
  createRulesetForStreamService(span, 'stream', 'All', ALL),
  createRulesetForStreamService(span, 'stream_us', 'North America', NORTH_AMERICA),
  createRulesetForStreamService(span, 'stream_eu', 'Europe', EU),
  createRulesetForStreamService(span, 'stream_hk', 'Hong Kong', HK),
  createRulesetForStreamService(span, 'stream_tw', 'Taiwan', TW),
  createRulesetForStreamService(span, 'stream_jp', 'Japan', JP),
  // createRulesetForStreamService('stream_au', 'Oceania', AU),
  createRulesetForStreamService(span, 'stream_kr', 'Korean', KR),
  // createRulesetForStreamService('stream_south_east_asia', 'South East Asia', SOUTH_EAST_ASIA)
  createRulesetForStreamService(span, 'stream_biliintl', 'Bilibili International', BILI_INTL)
]));
