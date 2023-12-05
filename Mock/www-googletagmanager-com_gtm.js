(function () {
  'use strict';

  const noopfn = function () {
  };
  const w = window;
  w.ga = w.ga || noopfn;
  const dl = w.dataLayer;
  if (typeof dl !== 'object') { return; }
  if (typeof dl.hide === 'object' && typeof dl.hide.end === 'function') {
    dl.hide.end();
  }
  if (typeof dl.push === 'function') {
    dl.push = function (o) {
      if (
        typeof o === 'object'
        && typeof o.eventCallback === 'function'
      ) {
        // eslint-disable-next-line sukka/prefer-timer-id -- deliberately use setTimeout
        setTimeout(o.eventCallback, 1);
      }
    };
  }
}());
