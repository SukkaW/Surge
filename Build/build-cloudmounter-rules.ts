import path from 'node:path';
import { DOMAINS, PROCESS_NAMES } from '../Source/non_ip/cloudmounter';
import { SHARED_DESCRIPTION } from './lib/constants';
import { createRuleset } from './lib/create-file';
import { task } from './trace';

const outputSurgeDir = path.resolve(__dirname, '../List');
const outputClashDir = path.resolve(__dirname, '../Clash');
const outputSingboxDir = path.resolve(__dirname, '../sing-box');

export const buildCloudMounterRules = task(require.main === module, __filename)(async (span) => {
  // AND,((SRC-IP,192.168.1.110), (DOMAIN, example.com))

  const results = DOMAINS.flatMap(domain => {
    return PROCESS_NAMES.flatMap(process => [
      `AND,((${domain}),(PROCESS-NAME,${process}))`,
      ...[
        '10.0.0.0/8',
        '127.0.0.0/8',
        '172.16.0.0/12',
        '192.168.0.0/16'
      ].map(cidr => `AND,((${domain}),(SRC-IP,${cidr}))`)
    ]);
  });

  const description = SHARED_DESCRIPTION;

  return createRuleset(
    span,
    'Sukka\'s Ruleset - CloudMounter / RaiDrive',
    description,
    new Date(),
    results,
    'ruleset',
    path.resolve(outputSurgeDir, 'non_ip', 'cloudmounter.conf'),
    path.resolve(outputClashDir, 'non_ip', 'cloudmounter.txt'),
    path.resolve(outputSingboxDir, 'non_ip', 'cloudmounter.json')
  );
});
