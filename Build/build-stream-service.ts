// @ts-check
import type { Span } from './trace';
import { task } from './trace';

import path from 'path';
import { createRuleset } from './lib/create-file';

import { ALL, NORTH_AMERICA, EU, HK, TW, JP, KR } from '../Source/stream';
import { SHARED_DESCRIPTION } from './lib/constants';

export const createRulesetForStreamService = (span: Span, fileId: string, title: string, streamServices: Array<import('../Source/stream').StreamService>) => {
  return span.traceChildAsync(fileId, async (childSpan) => Promise.all([
    // Domains
    createRuleset(
      childSpan,
      `Sukka's Ruleset - Stream Services: ${title}`,
      [
        ...SHARED_DESCRIPTION,
        '',
        ...streamServices.map((i) => `- ${i.name}`)
      ],
      new Date(),
      streamServices.flatMap((i) => i.rules),
      'ruleset',
      path.resolve(__dirname, `../List/non_ip/${fileId}.conf`),
      path.resolve(__dirname, `../Clash/non_ip/${fileId}.txt`)
    ),
    // IP
    createRuleset(
      childSpan,
      `Sukka's Ruleset - Stream Services' IPs: ${title}`,
      [
        ...SHARED_DESCRIPTION,
        '',
        ...streamServices.map((i) => `- ${i.name}`)
      ],
      new Date(),
      streamServices.flatMap((i) => (
        i.ip
          ? [
            ...i.ip.v4.map((ip) => `IP-CIDR,${ip},no-resolve`),
            ...i.ip.v6.map((ip) => `IP-CIDR6,${ip},no-resolve`)
          ]
          : []
      )),
      'ruleset',
      path.resolve(__dirname, `../List/ip/${fileId}.conf`),
      path.resolve(__dirname, `../Clash/ip/${fileId}.txt`)
    )
  ]));
};

export const buildStreamService = task(require.main === module, __filename)(async (span) => {
  return Promise.all([
    createRulesetForStreamService(span, 'stream', 'All', ALL),
    createRulesetForStreamService(span, 'stream_us', 'North America', NORTH_AMERICA),
    createRulesetForStreamService(span, 'stream_eu', 'Europe', EU),
    createRulesetForStreamService(span, 'stream_hk', 'Hong Kong', HK),
    createRulesetForStreamService(span, 'stream_tw', 'Taiwan', TW),
    createRulesetForStreamService(span, 'stream_jp', 'Japan', JP),
    // createRulesetForStreamService('stream_au', 'Oceania', AU),
    createRulesetForStreamService(span, 'stream_kr', 'Korean', KR)
    // createRulesetForStreamService('stream_south_east_asia', 'South East Asia', SOUTH_EAST_ASIA)
  ]);
});
