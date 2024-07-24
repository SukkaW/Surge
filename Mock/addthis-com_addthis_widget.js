(function () {
  'use strict';

  const noopfn = function () {
    // noop
  };
  window.addthis = {
    addEventListener: noopfn,
    button: noopfn,
    counter: noopfn,
    init: noopfn,
    layers: noopfn,
    ready: noopfn,
    sharecounters: {
      getShareCounts: noopfn
    },
    toolbox: noopfn,
    update: noopfn
  };
}());
