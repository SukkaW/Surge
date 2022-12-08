(function () {
  'use strict';
  const noopfn = function () {
  };
  window.cxApi = {
    chooseVariation: function () {
      return 0;
    },
    getChosenVariation: noopfn,
    setAllowHash: noopfn,
    setChosenVariation: noopfn,
    setCookiePath: noopfn,
    setDomainName: noopfn
  };
})();
