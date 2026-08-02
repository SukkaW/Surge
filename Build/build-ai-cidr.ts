import { fastIpVersion } from 'foxts/fast-ip-version';
import { SHARED_DESCRIPTION } from './constants/description';
import { $$fetch } from './lib/fetch-retry';
import { RulesetOutput } from './lib/rules/ruleset';
import { task } from './trace';

const OPENAI_VOICE_IP_URL = 'https://openai.com/chatgpt-voice.json';

function parseOpenAIVoiceJSON(data: unknown) {
  if (
    data === null
    || typeof data !== 'object'
    || !('prefixes' in data)
    || !Array.isArray(data.prefixes)
  ) {
    throw new TypeError('Invalid OpenAI Voice IP list: missing prefixes array');
  }

  if (!('creationTime' in data) || typeof data.creationTime !== 'string') {
    throw new TypeError('Invalid OpenAI Voice IP list: missing creationTime');
  }

  const lastUpdated = new Date(data.creationTime);
  if (Number.isNaN(lastUpdated.getTime())) {
    throw new TypeError('Invalid OpenAI Voice IP list: invalid creationTime');
  }

  const cidr4 = new Set<string>();
  const cidr6 = new Set<string>();

  for (let i = 0, len = data.prefixes.length; i < len; i++) {
    const entry = data.prefixes[i];
    if (typeof entry !== 'object' || entry == null) {
      throw new TypeError(`Invalid OpenAI Voice IP list entry at prefixes[${i}]`);
    }

    const prefixes = Object.values(entry);
    if (prefixes.length === 0) {
      continue;
    }

    for (let j = 0, prefixLen = prefixes.length; j < prefixLen; j++) {
      const prefix = prefixes[j];
      if (typeof prefix !== 'string') {
        throw new TypeError(`Invalid IP prefix at prefixes[${i}]`);
      }

      const version = fastIpVersion(prefix);
      if (version === 4) {
        cidr4.add(prefix);
      } else if (version === 6) {
        cidr6.add(prefix);
      } else {
        throw new TypeError(`Invalid IP prefix at prefixes[${i}]`);
      }
    }
  }

  return {
    cidr4: Array.from(cidr4),
    cidr6: Array.from(cidr6),
    lastUpdated
  };
}

export const buildAICIDR = task(require.main === module, __filename)(async (span) => {
  const { cidr4, cidr6, lastUpdated } = await span.traceChildAsync('get OpenAI Voice IP ranges', async () => {
    const response = await $$fetch(OPENAI_VOICE_IP_URL);
    return parseOpenAIVoiceJSON(await response.json());
  });

  return new RulesetOutput(span, 'ai', 'ip')
    .withTitle('Sukka\'s Ruleset - ChatGPT Voice IP CIDR')
    .appendDescription(
      SHARED_DESCRIPTION,
      '',
      'This file contains IP ranges used by ChatGPT Voice.'
    )
    .withDate(lastUpdated)
    .appendDataSource(`${OPENAI_VOICE_IP_URL} (last updated: ${lastUpdated.toISOString()})`)
    .bulkAddCIDR4NoResolve(cidr4)
    .bulkAddCIDR6NoResolve(cidr6)
    .write();
});
