export function createFileDescription(license = 'AGPL 3.0') {
  return [
    `License: ${license}`,
    'Homepage: https://ruleset.skk.moe',
    'GitHub: https://github.com/SukkaW/Surge'
  ];
}

export const SHARED_DESCRIPTION = createFileDescription('AGPL 3.0');
