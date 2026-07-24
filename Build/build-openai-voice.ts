import { fastIpVersion } from 'foxts/fast-ip-version';
import { SHARED_DESCRIPTION } from './constants/description';
import { $$fetch } from './lib/fetch-retry';
import { RulesetOutput } from './lib/rules/ruleset';
import { task } from './trace';

const OPENAI_VOICE_IP_URL = 'https://openai.com/chatgpt-voice.json';

function readPrefix(
  entry: Record<string, unknown>,
  field: 'ipv4Prefix' | 'ipv6Prefix',
  version: 4 | 6,
  index: number
) {
  const value = entry[field];
  if (value === undefined) return null;

  if (typeof value !== 'string' || fastIpVersion(value) !== version) {
    throw new TypeError(`Invalid ${field} at prefixes[${index}]`);
  }

  return value;
}

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
    if (entry === null || typeof entry !== 'object') {
      throw new TypeError(`Invalid OpenAI Voice IP list entry at prefixes[${i}]`);
    }

    const ipv4 = readPrefix(entry as Record<string, unknown>, 'ipv4Prefix', 4, i);
    const ipv6 = readPrefix(entry as Record<string, unknown>, 'ipv6Prefix', 6, i);

    if (ipv4 === null && ipv6 === null) {
      throw new TypeError(`OpenAI Voice IP list entry prefixes[${i}] has no IP prefix`);
    }

    if (ipv4 !== null) cidr4.add(ipv4);
    if (ipv6 !== null) cidr6.add(ipv6);
  }

  if (cidr4.size + cidr6.size === 0) {
    throw new TypeError('OpenAI Voice IP list is empty');
  }

  return {
    cidr4: Array.from(cidr4),
    cidr6: Array.from(cidr6),
    lastUpdated
  };
}

export const buildOpenAIVoice = task(require.main === module, __filename)(async (span) => {
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
