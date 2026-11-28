/**
 * Domain generation algorithm of the Clickadu Anti-Adblock loader (1.1.84-st).
 *
 * This is a port of the `url()` export of the WASM module that the loader inlines.
 */

const HOUR = 60 * 60 * 1000;
const BUCKET = 6 * HOUR;

const BRANCH_START = Date.UTC(2026, 1, 20);
const TIME_CAP = Date.UTC(2026, 11, 18, 23, 59, 59, 999);
const COM_TLD_START = Date.UTC(2026, 6, 6);
const COM_TLD_END = Date.UTC(2026, 6, 20);

const CONSONANTS = 'bcdfghjklmnpqrstvwxz';
const VOWELS = 'aeiouy';

const BASE_FLAG = 0x40_00_00;
const UTC_MINUS_5_FLAG = 0x2_00_00_00;
const UTC_PLUS_3_OR_9_FLAG = 0x1_00_00_00;

// Copied from the WASM data segment at offset 1072
const BUCKETS_WITHOUT_BASE_FLAG = new Set([
  82275, 82355, 82663, 82695, 82825, 82857, 82908, 82928,
  83020, 83025, 83110, 83122, 83146, 83177, 83197, 83214
]);

// The groups are every other zone, UTC-5, and UTC+3 with UTC+9.
const TIMEZONE_GROUPS = [0, 300, -180] as const;

function createLcg(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 19 + 3617) % 100_000_007;
    return state;
  };
}

function generateWord(next: () => number, minLength: number, maxLength: number) {
  const length = (next() % (maxLength - minLength + 1)) + minLength;

  let word = '';
  let countdown = 3;
  let lastWasVowel = false;

  for (let i = 0; i < length; i++) {
    const position = i % 3;
    if (position === 0) countdown = 3;

    const value = next();
    let char = CONSONANTS[value % 20];

    if (position !== 0 && lastWasVowel) {
      lastWasVowel = true;
    } else if (value % countdown === 0) {
      char = VOWELS[value % 6];
      lastWasVowel = true;
    } else {
      lastWasVowel = false;
    }

    word += char;
    countdown--;
  }

  return word;
}

/**
 * @param timestamp Milliseconds since the epoch, not earlier than 2026-02-20
 * @param timezoneOffset Value of `Date#getTimezoneOffset()`: minutes, positive west of UTC
 */
export function getClickaduDgaDomain(timestamp: number, timezoneOffset: number): string {
  if (timestamp < BRANCH_START) {
    throw new RangeError('Clickadu DGA: only timestamps after 2026-02-20 are implemented');
  }

  let flags = BUCKETS_WITHOUT_BASE_FLAG.has(Math.floor(timestamp / BUCKET)) ? 0 : BASE_FLAG;

  const timezoneHour = Math.floor(((720 + timezoneOffset) % 1440) / 60);
  if (timezoneHour === 17) {
    flags |= UTC_MINUS_5_FLAG;
  } else if (timezoneHour === 3 || timezoneHour === 9) {
    flags |= UTC_PLUS_3_OR_9_FLAG;
  }

  const bucket = Math.floor(Math.min(timestamp, TIME_CAP) / BUCKET);
  const next = createLcg(bucket | flags);
  next();
  next();

  const tld = timestamp >= COM_TLD_START && timestamp < COM_TLD_END ? 'com' : 'in';
  return generateWord(next, 8, 12) + '.' + tld;
}

export function getClickaduDgaDomains(from: number, to: number): string[] {
  const domains = new Set<string>();

  // The loader shifts time back 6 hours when it detects automation, so include one earlier bucket
  const start = Math.max(BRANCH_START, (Math.floor(from / BUCKET) - 1) * BUCKET);
  for (let timestamp = start; timestamp <= to; timestamp += BUCKET) {
    for (const timezoneOffset of TIMEZONE_GROUPS) {
      domains.add(getClickaduDgaDomain(timestamp, timezoneOffset));
    }
  }

  return Array.from(domains);
}
