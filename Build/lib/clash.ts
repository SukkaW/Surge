const unsupported = Symbol('unsupported');

// https://dreamacro.github.io/clash/configuration/rules.html
export const PROCESSOR: Record<string, ((raw: string, type: string, value: string) => string) | typeof unsupported> = {
  'URL-REGEX': unsupported,
  'USER-AGENT': unsupported
};
