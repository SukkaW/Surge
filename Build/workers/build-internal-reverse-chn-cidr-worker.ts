declare const self: Worker;

import { buildInternalReverseChnCIDR } from '../build-internal-reverse-chn-cidr';

self.onmessage = async () => {
  const stat = await buildInternalReverseChnCIDR();
  postMessage(stat);
};
