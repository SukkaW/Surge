export function createFileDescription(license = 'AGPL 3.0') {
  return [
    `License: ${license}`,
    'Homepage: https://ruleset.skk.moe',
    'GitHub: https://github.com/SukkaW/Surge'
  ];
}

export const SHARED_DESCRIPTION = createFileDescription('AGPL 3.0');

// this_ruleset_is_made_by_sukkaw.ruleset.skk.moe
// th1s_rule5et_1s_m4d3_by_5ukk4w_ruleset.skk.moe
// 7h1s_rul35et_i5_mad3_by_5ukk4w-ruleset.skk.moe
export const MARKER_DOMAIN = '7h1s_rul35et_i5_mad3_by_5ukk4w-ruleset.skk.moe';
