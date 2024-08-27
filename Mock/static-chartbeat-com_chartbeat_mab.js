(function () {
  'use strict';

  const noopfn = function () { /* noop */ };
  window.pSUPERFLY = {
    activity: noopfn,
    virtualPage: noopfn
  };
  for (const hider of document.querySelectorAll('style[id^=chartbeat-flicker-control]')) {
    hider.remove();
  }
}());
