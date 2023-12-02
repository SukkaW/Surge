declare const self: Worker;

import { buildInternalReverseChnCIDR } from '../build-internal-reverse-chn-cidr';

// preload the task
const promise = buildInternalReverseChnCIDR();

const handleMessage = async (e: MessageEvent<'build' | 'exit'>) => {
  if (e.data === 'build') {
    const stat = await promise;
    postMessage(stat);
  } else /* if (e.data === 'exit') */ {
    self.removeEventListener('message', handleMessage);
    self.unref();
    self.terminate();
  }
};

self.addEventListener('message', handleMessage);
