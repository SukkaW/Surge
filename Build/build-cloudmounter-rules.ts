import { DOMAINS, PROCESS_NAMES } from '../Source/non_ip/cloudmounter';
import { SHARED_DESCRIPTION } from './constants/description';
import { task } from './trace';
import { RulesetOutput } from './lib/create-file';

export const buildCloudMounterRules = task(require.main === module, __filename)(async (span) => {
  // AND,((SRC-IP,192.168.1.110), (DOMAIN, example.com))

  const results = DOMAINS.flatMap(domain => PROCESS_NAMES.flatMap(process => [
    `AND,((${domain}),(PROCESS-NAME,${process}))`,
    ...[
      '10.0.0.0/8',
      // '127.0.0.0/8',
      '172.16.0.0/12',
      '192.168.0.0/16'
    ].map(cidr => `AND,((${domain}),(SRC-IP,${cidr}))`)
  ]));

  const description = SHARED_DESCRIPTION;

  return new RulesetOutput(span, 'cloudmounter', 'non_ip')
    .withTitle('Sukka\'s Ruleset - CloudMounter / RaiDrive')
    .withDescription(description)
    .addFromRuleset(results)
    .write();
});
