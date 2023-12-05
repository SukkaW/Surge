(function () {
  'use strict';

  // https://developers.google.com/doubleclick-gpt/reference
  const noopfn = function () {
  }.bind();
  const noopthisfn = function () {
    return this;
  };
  const noopnullfn = function () {
    return null;
  };
  const nooparrayfn = function () {
    return [];
  };
  const noopstrfn = function () {
    return '';
  };
  //
  const companionAdsService = {
    addEventListener: noopthisfn,
    enableSyncLoading: noopfn,
    setRefreshUnfilledSlots: noopfn
  };
  const contentService = {
    addEventListener: noopthisfn,
    setContent: noopfn
  };
  const PassbackSlot = function () {
  };
  let p = PassbackSlot.prototype;
  p.display = noopfn;
  p.get = noopnullfn;
  p.set = noopthisfn;
  p.setClickUrl = noopthisfn;
  p.setTagForChildDirectedTreatment = noopthisfn;
  p.setTargeting = noopthisfn;
  p.updateTargetingFromMap = noopthisfn;
  const pubAdsService = {
    addEventListener: noopthisfn,
    clear: noopfn,
    clearCategoryExclusions: noopthisfn,
    clearTagForChildDirectedTreatment: noopthisfn,
    clearTargeting: noopthisfn,
    collapseEmptyDivs: noopfn,
    defineOutOfPagePassback() { return new PassbackSlot(); },
    definePassback() { return new PassbackSlot(); },
    disableInitialLoad: noopfn,
    display: noopfn,
    enableAsyncRendering: noopfn,
    enableSingleRequest: noopfn,
    enableSyncRendering: noopfn,
    enableVideoAds: noopfn,
    get: noopnullfn,
    getAttributeKeys: nooparrayfn,
    getTargeting: noopfn,
    getTargetingKeys: nooparrayfn,
    getSlots: nooparrayfn,
    refresh: noopfn,
    removeEventListener: noopfn,
    set: noopthisfn,
    setCategoryExclusion: noopthisfn,
    setCentering: noopfn,
    setCookieOptions: noopthisfn,
    setForceSafeFrame: noopthisfn,
    setLocation: noopthisfn,
    setPublisherProvidedId: noopthisfn,
    setPrivacySettings: noopthisfn,
    setRequestNonPersonalizedAds: noopthisfn,
    setSafeFrameConfig: noopthisfn,
    setTagForChildDirectedTreatment: noopthisfn,
    setTargeting: noopthisfn,
    setVideoContent: noopthisfn,
    updateCorrelator: noopfn
  };
  const SizeMappingBuilder = function () {
  };
  p = SizeMappingBuilder.prototype;
  p.addSize = noopthisfn;
  p.build = noopnullfn;
  const Slot = function () {
  };
  p = Slot.prototype;
  p.addService = noopthisfn;
  p.clearCategoryExclusions = noopthisfn;
  p.clearTargeting = noopthisfn;
  p.defineSizeMapping = noopthisfn;
  p.get = noopnullfn;
  p.getAdUnitPath = nooparrayfn;
  p.getAttributeKeys = nooparrayfn;
  p.getCategoryExclusions = nooparrayfn;
  p.getDomId = noopstrfn;
  p.getResponseInformation = noopnullfn;
  p.getSlotElementId = noopstrfn;
  p.getSlotId = noopthisfn;
  p.getTargeting = nooparrayfn;
  p.getTargetingKeys = nooparrayfn;
  p.set = noopthisfn;
  p.setCategoryExclusion = noopthisfn;
  p.setClickUrl = noopthisfn;
  p.setCollapseEmptyDiv = noopthisfn;
  p.setTargeting = noopthisfn;
  p.updateTargetingFromMap = noopthisfn;
  //
  const gpt = window.googletag || {};
  const cmd = gpt.cmd || [];
  gpt.apiReady = true;
  gpt.cmd = [];
  gpt.cmd.push = function (a) {
    try {
      a();
    } catch {
    }
    return 1;
  };
  gpt.companionAds = function () { return companionAdsService; };
  gpt.content = function () { return contentService; };
  gpt.defineOutOfPageSlot = function () { return new Slot(); };
  gpt.defineSlot = function () { return new Slot(); };
  gpt.destroySlots = noopfn;
  gpt.disablePublisherConsole = noopfn;
  gpt.display = noopfn;
  gpt.enableServices = noopfn;
  gpt.getVersion = noopstrfn;
  gpt.pubads = function () { return pubAdsService; };
  gpt.pubadsReady = true;
  gpt.setAdIframeTitle = noopfn;
  gpt.sizeMapping = function () { return new SizeMappingBuilder(); };
  window.googletag = gpt;
  while (cmd.length !== 0) {
    gpt.cmd.push(cmd.shift());
  }
}());
