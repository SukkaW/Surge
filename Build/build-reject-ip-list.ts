// @ts-check
import path from 'node:path';
import { task } from './trace';
import { compareAndWriteFile } from './lib/create-file';
import { OUTPUT_INTERNAL_DIR } from './constants/dir';
import { AUGUST_ASN, HUIZE_ASN } from '../Source/ip/badboy_asn';

// Notice: botnet and bogus_nxdomain has been moved to build-reject-domainset
export const buildRejectIPList = task(require.main === module, __filename)(async (span) => Promise.all([
  compareAndWriteFile(span, [AUGUST_ASN.join(' ')], path.join(OUTPUT_INTERNAL_DIR, 'august_asn.txt')),
  compareAndWriteFile(span, [HUIZE_ASN.join(' ')], path.join(OUTPUT_INTERNAL_DIR, 'huize_asn.txt'))
]));
