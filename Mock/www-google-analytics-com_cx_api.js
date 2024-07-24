(function () {
  'use strict';

  const noopfn = function () {
    // noop
  };
  window.cxApi = {
    chooseVariation() {
      return 0;
    },
    getChosenVariation: noopfn,
    setAllowHash: noopfn,
    setChosenVariation: noopfn,
    setCookiePath: noopfn,
    setDomainName: noopfn
  };
}());
