declare const self: Worker;

self.addEventListener('message', async (e: MessageEvent<'build' | 'exit'>) => {
  if (e.data === 'build') {
    const { buildInternalReverseChnCIDR } = await import('../build-internal-reverse-chn-cidr');
    const stat = await buildInternalReverseChnCIDR();
    postMessage(stat);
  } else if (e.data === 'exit') {
    process.exit(0);
  }
}, { once: true });
