import { appendArrayInPlace } from 'foxts/append-array-in-place';
import { GLOBAL } from '../Source/non_ip/global';
import { createGetDnsMappingRule } from './build-domestic-direct-lan-ruleset-dns-mapping-module';
import { SOURCE_DIR } from './constants/dir';
import { task } from './trace';
import { once } from 'foxts/once';
import path from 'node:path';
import { readFileIntoProcessedArray } from './lib/fetch-text-by-line';
import { SHARED_DESCRIPTION } from './constants/description';
import { RulesetOutput } from './lib/rules/ruleset';

export const getGlobalRulesetPromise = once(async () => {
  const globals = await readFileIntoProcessedArray(path.join(SOURCE_DIR, 'non_ip/global.conf'));
  const getDnsMappingRuleWithWildcard = createGetDnsMappingRule(true);

  [GLOBAL].forEach((item) => {
    Object.values(item).forEach(({ domains }) => {
      appendArrayInPlace(globals, domains.flatMap(getDnsMappingRuleWithWildcard));
    });
  });

  return [globals] as const;
});

export const buildGlobalRuleset = task(require.main === module, __filename)(async (span) => {
  const [globals] = await getGlobalRulesetPromise();
  return new RulesetOutput(span, 'global', 'non_ip')
    .withTitle('Sukka\'s Ruleset - General Global Services')
    .appendDescription(
      SHARED_DESCRIPTION,
      '',
      'This file contains rules for services that are NOT available inside the Mainland China.'
    )
    .addFromRuleset(globals)
    .write();
});
