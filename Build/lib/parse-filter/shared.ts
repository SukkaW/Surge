import picocolors from 'picocolors';
import { DEBUG_DOMAIN_TO_FIND } from '../../constants/reject-data-source';
import { noop } from 'foxts/noop';

export const foundDebugDomain = { value: false };

export const onBlackFound = DEBUG_DOMAIN_TO_FIND
  ? (line: string, meta: string) => {
    if (line.includes(DEBUG_DOMAIN_TO_FIND!)) {
      console.warn(picocolors.red(meta), '(black)', line.replaceAll(DEBUG_DOMAIN_TO_FIND!, picocolors.bold(DEBUG_DOMAIN_TO_FIND)));
      foundDebugDomain.value = true;
    }
  }
  : noop;

export const onWhiteFound = DEBUG_DOMAIN_TO_FIND
  ? (line: string, meta: string) => {
    if (line.includes(DEBUG_DOMAIN_TO_FIND!)) {
      console.warn(picocolors.red(meta), '(white)', line.replaceAll(DEBUG_DOMAIN_TO_FIND!, picocolors.bold(DEBUG_DOMAIN_TO_FIND)));
      foundDebugDomain.value = true;
    }
  }
  : noop;
