(async () => {
  const { buildInternalReverseChnCIDR } = await import('../build-internal-reverse-chn-cidr');
  const stat = await buildInternalReverseChnCIDR();
  postMessage(stat);
})();
