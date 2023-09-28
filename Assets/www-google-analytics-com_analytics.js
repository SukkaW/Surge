(function () {
  'use strict';

  // https://developers.google.com/analytics/devguides/collection/analyticsjs/
  const noopfn = function () {
  };
    //
  const Tracker = function () {
  };
  const p = Tracker.prototype;
  p.get = noopfn;
  p.set = noopfn;
  p.send = noopfn;
  //
  const w = window;
  const gaName = w.GoogleAnalyticsObject || 'ga';
  const gaQueue = w[gaName];
  const ga = function (...args) {
    const len = args.length;
    if (len === 0) { return; }
    let fn;
    const a = args[len - 1];
    if (typeof a === 'object' && typeof a.hitCallback === 'function') {
      fn = a.hitCallback;
    } else if (typeof a === 'function') {
      fn = () => { a(ga.create()); };
    } else {
      const pos = args.indexOf('hitCallback');
      if (pos !== -1 && typeof args[pos + 1] === 'function') {
        fn = args[pos + 1];
      }
    }
    if (typeof fn !== 'function') { return; }
    try {
      fn();
    } catch (ex) {
    }
  };
  ga.create = function () {
    return new Tracker();
  };
  ga.getByName = function () {
    return new Tracker();
  };
  ga.getAll = function () {
    return [new Tracker()];
  };
  ga.remove = noopfn;
  // https://github.com/uBlockOrigin/uAssets/issues/2107
  ga.loaded = true;
  w[gaName] = ga;
  // https://github.com/gorhill/uBlock/issues/3075
  const dl = w.dataLayer;
  if (typeof dl === 'object') {
    if (typeof dl.hide === 'object' && typeof dl.hide.end === 'function') {
      dl.hide.end();
      dl.hide.end = () => { };
    }
    if (typeof dl.push === 'function') {
      const doCallback = function (item) {
        if (typeof item === 'object' === false) { return; }
        if (typeof item.eventCallback !== 'function') { return; }
        // eslint-disable-next-line sukka/prefer-timer-id -- deliberate use of setTimeout
        setTimeout(item.eventCallback, 1);
        item.eventCallback = () => { };
      };
      dl.push = new Proxy(dl.push, {
        apply(target, thisArg, args) {
          doCallback(args[0]);
          return Reflect.apply(target, thisArg, args);
        }
      });
      if (Array.isArray(dl)) {
        const q = dl.slice();
        for (const item of q) {
          doCallback(item);
        }
      }
    }
  }
  // empty ga queue
  if (typeof gaQueue === 'function' && Array.isArray(gaQueue.q)) {
    const q = gaQueue.q.slice();
    gaQueue.q.length = 0;
    for (const entry of q) {
      ga(...entry);
    }
  }
}());
